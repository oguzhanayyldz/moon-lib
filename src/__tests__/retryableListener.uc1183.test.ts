/**
 * UC-1183 — RetryableListener: a stuck job must not hold its lock forever, and must become visible.
 *
 * - maxLockHoldMs (default 0 = off): once exceeded the moon-lib heartbeat stops (logger.warn + retryable_listener_stuck_total{reason="max_lock_hold"});
 *   the lock then expires at its TTL.
 * - same-message redelivery counter: while the lock holder is still working, every redelivery of the same message is counted;
 *   at stuckRedeliveryThreshold the metric ticks once (reason="redelivery") and a warn is logged on every delivery from there on.
 * RetryableListener runs as production code; Redis is the in-memory fake, NATS and Mongo are fakes.
 */
import { RetryableListener, resolveMaxLockHoldMs, resolveStuckRedeliveryThreshold } from '../events/retryableListener';
import { Event, Subjects } from '../common';
import { EventMetrics } from '../metrics/EventMetrics';
import { logger } from '../services/logger.service';
import { redisWrapper } from '../services/redisWrapper.service';
import { InMemoryRedis } from '../test/fakes/inMemoryRedis';
import { createDeadLetterStore, createFakeMessage, createFakeStan, wasAcked } from '../test/fakes/eventDeliveryHarness';
import { envScopedKey } from '../utils/redisEnvScope.util';

jest.mock('../services/redisWrapper.service', () => {
    const { InMemoryRedis: Redis } = jest.requireActual('../test/fakes/inMemoryRedis');
    return { redisWrapper: { client: new Redis() } };
});

jest.mock('../services/logger.service', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

jest.mock('../metrics/EventMetrics', () => ({
    EventMetrics: {
        eventProcessingDuration: { observe: jest.fn() },
        eventProcessingTotal: { inc: jest.fn() },
        eventRetryTotal: { inc: jest.fn() },
        eventDlqTotal: { inc: jest.fn() },
        eventDuplicateKeyTotal: { inc: jest.fn() },
        eventDlqWriteErrorTotal: { inc: jest.fn() },
        eventDlqReplayTotal: { inc: jest.fn() },
        eventPermanentErrorTotal: { inc: jest.fn() },
        retryableListenerStuckTotal: { inc: jest.fn() },
    }
}));

interface StuckEvent extends Event {
    subject: Subjects.OrderCreated;
    data: { id: string };
}

const payload: StuckEvent['data'] = { id: 'stuck-1' };
const lockKey = envScopedKey(`lock:${Subjects.OrderCreated}:stuck-${payload.id}`);

class StuckListener extends RetryableListener<StuckEvent> {
    subject: Subjects.OrderCreated = Subjects.OrderCreated;
    queueGroupName = 'uc1183-test';
    work: () => Promise<void> = async () => undefined;

    protected async processEvent(): Promise<void> {
        await this.work();
    }

    protected getEventId(data: StuckEvent['data']): string {
        return `stuck-${data.id}`;
    }
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const stuckMetric = () => (EventMetrics.retryableListenerStuckTotal.inc as jest.Mock).mock.calls.map(([labels]) => labels);
const stuckWarns = () => (logger.warn as jest.Mock).mock.calls.filter(([m]) => String(m).includes('looks stuck')).length;

function newListener(options: ConstructorParameters<typeof RetryableListener>[1] = {}) {
    const nats = createFakeStan();
    const deadLetters = createDeadLetterStore();
    return new StuckListener(nats.client, options, deadLetters.connection);
}

beforeEach(() => {
    jest.clearAllMocks();
    (redisWrapper.client as unknown as InMemoryRedis).flushAll();
    delete process.env.RETRYABLE_MAX_LOCK_HOLD_MS;
    delete process.env.RETRYABLE_STUCK_REDELIVERY_THRESHOLD;
});

describe('UC-1183 option resolvers', () => {
    it.each([
        [undefined, undefined, 0],
        [5000, undefined, 5000],
        [0, '3000', 0],
        [undefined, '3000', 3000],
        [undefined, 'abc', 0],
        [-1, undefined, 0],
        [1.5, undefined, 0],
    ])('maxLockHoldMs explicit %p, env %p → %p', (explicit, env, expected) => {
        if (env !== undefined) process.env.RETRYABLE_MAX_LOCK_HOLD_MS = env;
        expect(resolveMaxLockHoldMs(explicit as number | undefined)).toBe(expected);
    });

    it.each([
        [undefined, undefined, 5],
        [3, undefined, 3],
        [0, '7', 0],
        [undefined, '7', 7],
        [undefined, '-2', 5],
    ])('stuckRedeliveryThreshold explicit %p, env %p → %p', (explicit, env, expected) => {
        if (env !== undefined) process.env.RETRYABLE_STUCK_REDELIVERY_THRESHOLD = env;
        expect(resolveStuckRedeliveryThreshold(explicit as number | undefined)).toBe(expected);
    });
});

describe('UC-1183 maxLockHoldMs', () => {
    it('stuck job: renewal stops after the limit, the lock expires, warn logged (not error) and metric counted', async () => {
        const listener = newListener({ lockTimeoutSec: 1, maxLockHoldMs: 700 }); // renew every 333 ms
        listener.work = () => sleep(2600);
        const msg = createFakeMessage(payload, 3);

        const running = listener.onMessage(payload, msg);
        await sleep(2200); // last renewal ≈ 666 ms + 1 s TTL → expired by now, job still running

        expect({
            lock: await redisWrapper.client.get(lockKey),
            metric: stuckMetric(),
            warnLogged: (logger.warn as jest.Mock).mock.calls.some(([m]) => String(m).includes('heartbeat stopped after maxLockHoldMs')),
            errorLogged: (logger.error as jest.Mock).mock.calls.length > 0,
        }).toEqual({ lock: null, metric: [{ listener: 'StuckListener', reason: 'max_lock_hold' }], warnLogged: true, errorLogged: false });

        await running;
        expect(wasAcked(msg)).toBe(true);
    });

    it('maxLockHoldMs 0: no limit, lock is still renewed past the would-be limit', async () => {
        const listener = newListener({ lockTimeoutSec: 1, maxLockHoldMs: 0 });
        listener.work = () => sleep(1800);

        const running = listener.onMessage(payload, createFakeMessage(payload, 3));
        await sleep(1500);

        expect({ lockHeld: (await redisWrapper.client.get(lockKey)) !== null, metric: stuckMetric() })
            .toEqual({ lockHeld: true, metric: [] });
        await running;
    });
});

describe('UC-1183 same-message redelivery counter', () => {
    async function redeliver(listener: StuckListener, times: number) {
        for (let i = 0; i < times; i++) {
            await listener.onMessage(payload, createFakeMessage(payload, 9));
        }
    }

    it('below the threshold: no metric, no stuck warning', async () => {
        const listener = newListener({ lockTimeoutSec: 10, stuckRedeliveryThreshold: 3 });
        listener.work = () => sleep(600);
        const running = listener.onMessage(payload, createFakeMessage(payload, 9));
        await sleep(50);

        await redeliver(listener, 2);

        expect({ metric: stuckMetric(), warns: stuckWarns() }).toEqual({ metric: [], warns: 0 });
        await running;
    });

    it('at the threshold the metric ticks once; every delivery from there warns', async () => {
        const listener = newListener({ lockTimeoutSec: 10, stuckRedeliveryThreshold: 3 });
        listener.work = () => sleep(800);
        const running = listener.onMessage(payload, createFakeMessage(payload, 9));
        await sleep(50);

        await redeliver(listener, 5);

        expect({ metric: stuckMetric(), warns: stuckWarns() })
            .toEqual({ metric: [{ listener: 'StuckListener', reason: 'redelivery' }], warns: 3 });
        await running;
    });

    it('counts per message: redeliveries of two different sequences under the same eventId are not added up', async () => {
        const listener = newListener({ lockTimeoutSec: 10, stuckRedeliveryThreshold: 5 });
        listener.work = () => sleep(900);
        const first = listener.onMessage(payload, createFakeMessage(payload, 9));
        await sleep(50);
        for (let i = 0; i < 3; i++) await listener.onMessage(payload, createFakeMessage(payload, 9));
        await first;

        const second = listener.onMessage(payload, createFakeMessage(payload, 20));
        await sleep(50);
        for (let i = 0; i < 3; i++) await listener.onMessage(payload, createFakeMessage(payload, 20));

        expect({ metric: stuckMetric(), warns: stuckWarns() }).toEqual({ metric: [], warns: 0 });
        await second;
    });

    it('the counter key carries a TTL', async () => {
        const listener = newListener({ lockTimeoutSec: 10, stuckRedeliveryThreshold: 3 });
        listener.work = () => sleep(500);
        const running = listener.onMessage(payload, createFakeMessage(payload, 9));
        await sleep(50);
        await redeliver(listener, 1);

        const ttl = await redisWrapper.client.ttl(envScopedKey(`event:same-message-redelivery:${Subjects.OrderCreated}:stuck-${payload.id}:9`));

        expect(ttl).toBeGreaterThan(3500);
        expect(ttl).toBeLessThanOrEqual(3600);
        await running;
    });

    it('a failing counter does not break delivery: onMessage does not throw and the redelivery is not acked', async () => {
        const listener = newListener({ lockTimeoutSec: 10, stuckRedeliveryThreshold: 3 });
        listener.work = () => sleep(500);
        const running = listener.onMessage(payload, createFakeMessage(payload, 9));
        await sleep(50);
        const multi = jest.spyOn(redisWrapper.client as unknown as InMemoryRedis, 'multi')
            .mockImplementation(() => { throw new Error('redis down'); });
        const redelivery = createFakeMessage(payload, 9);

        await expect(listener.onMessage(payload, redelivery)).resolves.toBeUndefined();

        expect({
            acked: wasAcked(redelivery),
            metric: stuckMetric(),
            counterFailureLogged: (logger.warn as jest.Mock).mock.calls.some(([m]) => String(m).includes('Failed to count same-message redelivery')),
        }).toEqual({ acked: false, metric: [], counterFailureLogged: true });
        multi.mockRestore();
        await running;
    });

    it('threshold 0 turns the counter off: no warn, no counter key', async () => {
        const listener = newListener({ lockTimeoutSec: 10, stuckRedeliveryThreshold: 0 });
        listener.work = () => sleep(600);
        const running = listener.onMessage(payload, createFakeMessage(payload, 9));
        await sleep(50);

        await redeliver(listener, 6);

        expect({
            metric: stuckMetric(),
            warns: stuckWarns(),
            key: await redisWrapper.client.get(envScopedKey(`event:same-message-redelivery:${Subjects.OrderCreated}:stuck-${payload.id}:9`)),
        }).toEqual({ metric: [], warns: 0, key: null });
        await running;
    });
});
