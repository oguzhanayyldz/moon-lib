/**
 * UC-1020 — RetryableListener: in-process rerun on duplicate key (E11000) and the optional lock heartbeat.
 *
 * - duplicateKeyRetries (default 0 = behaviour unchanged): an E11000 is rerun in process up to N times.
 *   A race (the competing write created the record) succeeds on the rerun → 'resolved';
 *   a real duplicate keeps failing → acked as before → 'acked'. Other errors are never rerun.
 * - lockRenewIntervalMs (default 0 = off): the event lock is renewed while processEvent runs, only while it is still ours,
 *   and the renewal stops before the lock is released.
 * RetryableListener and RetryManager run as production code; Redis is the in-memory fake, NATS and Mongo are fakes.
 */
import { Message } from 'node-nats-streaming';
import { RetryableListener, resolveDuplicateKeyRetries } from '../events/retryableListener';
import { Event, Subjects } from '../common';
import { EventMetrics } from '../metrics/EventMetrics';
import { logger } from '../services/logger.service';
import { redisWrapper } from '../services/redisWrapper.service';
import { InMemoryRedis } from '../test/fakes/inMemoryRedis';
import { createDeadLetterStore, createFakeMessage, createFakeStan, wasAcked } from '../test/fakes/eventDeliveryHarness';
import { envScopedKey } from '../utils/redisEnvScope.util';
import { startLockHeartbeat } from '../utils/lockHeartbeat.util';

jest.mock('../services/redisWrapper.service', () => {
    const { InMemoryRedis: Redis } = jest.requireActual('../test/fakes/inMemoryRedis');
    return { redisWrapper: { client: new Redis() } };
});

jest.mock('../services/logger.service', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    }
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
    }
}));

interface OrderCopyEvent extends Event {
    subject: Subjects.OrderCreated;
    data: { id: string; version: number };
}

const payload: OrderCopyEvent['data'] = { id: 'order-1', version: 1 };
const eventId = `order-copy-${payload.id}`;
const lockKey = envScopedKey(`lock:${Subjects.OrderCreated}:${eventId}`);
const retryKey = envScopedKey(`event:retry:${Subjects.OrderCreated}:${eventId}`);

const duplicateKeyError = () =>
    Object.assign(new Error('E11000 duplicate key error collection: reporting.orders index: id_1'), { name: 'MongoServerError', code: 11000 });

/** Throws the queued errors one by one, then succeeds. Counts every processEvent call. */
class OrderCopyListener extends RetryableListener<OrderCopyEvent> {
    subject: Subjects.OrderCreated = Subjects.OrderCreated;
    queueGroupName = 'uc1020-test';
    calls = 0;
    errors: unknown[] = [];
    work: () => Promise<void> = async () => undefined;

    protected async processEvent(): Promise<void> {
        this.calls++;
        if (this.errors.length > 0) {
            throw this.errors.shift();
        }
        await this.work();
    }

    protected getEventId(data: OrderCopyEvent['data']): string {
        return `order-copy-${data.id}`;
    }
}

const duplicateKeyMetric = () => (EventMetrics.eventDuplicateKeyTotal.inc as jest.Mock).mock.calls.map(([labels]) => labels.outcome);
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function newListener(options: ConstructorParameters<typeof RetryableListener>[1] = {}) {
    const nats = createFakeStan();
    const deadLetters = createDeadLetterStore();
    return new OrderCopyListener(nats.client, options, deadLetters.connection);
}

beforeEach(() => {
    jest.clearAllMocks();
    (redisWrapper.client as unknown as InMemoryRedis).flushAll();
    delete process.env.RETRYABLE_DUPLICATE_KEY_RETRIES;
});

describe('UC-1020 resolveDuplicateKeyRetries', () => {
    afterEach(() => {
        delete process.env.RETRYABLE_DUPLICATE_KEY_RETRIES;
    });

    it.each([
        [undefined, undefined, 0],
        [2, undefined, 2],
        [0, '3', 0],
        [undefined, '1', 1],
        [undefined, '9', 5],
        [7, undefined, 5],
        [undefined, 'abc', 0],
        [undefined, '-2', 0],
        [-1, undefined, 0],
        [1.7, undefined, 0],
    ])('explicit %p, env %p → %p', (explicit, env, expected) => {
        if (env !== undefined) process.env.RETRYABLE_DUPLICATE_KEY_RETRIES = env;
        expect(resolveDuplicateKeyRetries(explicit as number | undefined)).toBe(expected);
    });
});

describe('UC-1020 duplicateKeyRetries — onMessage', () => {
    it('default 0: E11000 is acked on the first call, never rerun (behaviour unchanged)', async () => {
        const listener = newListener();
        listener.errors = [duplicateKeyError()];
        const msg = createFakeMessage(payload);

        await listener.onMessage(payload, msg);

        expect({ calls: listener.calls, acked: wasAcked(msg), metric: duplicateKeyMetric(), retryCounter: await redisWrapper.client.get(retryKey) })
            .toEqual({ calls: 1, acked: true, metric: ['acked'], retryCounter: null });
    });

    it('race: first call E11000, rerun succeeds → processed, acked, outcome resolved, no NATS retry', async () => {
        const listener = newListener({ duplicateKeyRetries: 1 });
        listener.errors = [duplicateKeyError()];
        const msg = createFakeMessage(payload);

        await listener.onMessage(payload, msg);

        expect({ calls: listener.calls, acked: wasAcked(msg), metric: duplicateKeyMetric(), retryCounter: await redisWrapper.client.get(retryKey), lock: await redisWrapper.client.get(lockKey) })
            .toEqual({ calls: 2, acked: true, metric: ['resolved'], retryCounter: null, lock: null });
    });

    it('real duplicate: E11000 on every call → rerun budget used, then acked as before, outcome acked', async () => {
        const listener = newListener({ duplicateKeyRetries: 2 });
        listener.errors = [duplicateKeyError(), duplicateKeyError(), duplicateKeyError(), duplicateKeyError()];
        const msg = createFakeMessage(payload);

        await listener.onMessage(payload, msg);

        expect({ calls: listener.calls, acked: wasAcked(msg), metric: duplicateKeyMetric(), retryCounter: await redisWrapper.client.get(retryKey) })
            .toEqual({ calls: 3, acked: true, metric: ['acked'], retryCounter: null });
    });

    it('env RETRYABLE_DUPLICATE_KEY_RETRIES enables the rerun when the listener sets no option', async () => {
        process.env.RETRYABLE_DUPLICATE_KEY_RETRIES = '1';
        const listener = newListener();
        listener.errors = [duplicateKeyError()];
        const msg = createFakeMessage(payload);

        await listener.onMessage(payload, msg);

        expect({ calls: listener.calls, acked: wasAcked(msg), metric: duplicateKeyMetric() }).toEqual({ calls: 2, acked: true, metric: ['resolved'] });
    });

    it('non-duplicate error is not rerun: one call, not acked, NATS retry counter incremented', async () => {
        const listener = newListener({ duplicateKeyRetries: 3 });
        listener.errors = [new Error('ECONNRESET: socket hang up')];
        const msg = createFakeMessage(payload);

        await listener.onMessage(payload, msg);

        expect({ calls: listener.calls, acked: wasAcked(msg), metric: duplicateKeyMetric(), retryCounter: await redisWrapper.client.get(retryKey) })
            .toEqual({ calls: 1, acked: false, metric: [], retryCounter: '1' });
    });

    it('E11000 then a different error: rerun stops at the different error and goes to the NATS retry path', async () => {
        const listener = newListener({ duplicateKeyRetries: 3 });
        listener.errors = [duplicateKeyError(), new Error('ECONNRESET: socket hang up')];
        const msg = createFakeMessage(payload);

        await listener.onMessage(payload, msg);

        expect({ calls: listener.calls, acked: wasAcked(msg), retryCounter: await redisWrapper.client.get(retryKey) })
            .toEqual({ calls: 2, acked: false, retryCounter: '1' });
    });

    it('enableLock false path also reruns', async () => {
        const listener = newListener({ enableLock: false, duplicateKeyRetries: 1 });
        listener.errors = [duplicateKeyError()];
        const msg = createFakeMessage(payload);

        await listener.onMessage(payload, msg);

        expect({ calls: listener.calls, acked: wasAcked(msg), metric: duplicateKeyMetric() }).toEqual({ calls: 2, acked: true, metric: ['resolved'] });
    });
});

describe('UC-1020 duplicateKeyRetries — replayDeadLetter', () => {
    it('race on replay: rerun succeeds → processed, outcome resolved', async () => {
        const listener = newListener({ duplicateKeyRetries: 1 });
        listener.errors = [duplicateKeyError()];

        const result = await listener.replayDeadLetter(payload);

        expect({ result, calls: listener.calls, metric: duplicateKeyMetric() }).toEqual({ result: 'processed', calls: 2, metric: ['resolved'] });
    });

    it('default 0 on replay: one call, duplicate treated as processed', async () => {
        const listener = newListener();
        listener.errors = [duplicateKeyError()];

        const result = await listener.replayDeadLetter(payload);

        expect({ result, calls: listener.calls }).toEqual({ result: 'processed', calls: 1 });
    });
});

describe('UC-1020 lockRenewIntervalMs — lock heartbeat', () => {
    const renewCalls = (spy: jest.SpyInstance) =>
        spy.mock.calls.filter(([script]) => String(script).includes('redis.call("expire"')).length;

    it('off by default: the lock is never renewed', async () => {
        const evalSpy = jest.spyOn(redisWrapper.client, 'eval');
        const listener = newListener({ lockTimeoutSec: 1 });
        listener.work = () => sleep(150);

        await listener.onMessage(payload, createFakeMessage(payload));

        expect(renewCalls(evalSpy)).toBe(0);
        evalSpy.mockRestore();
    });

    it('keeps the lock alive past its TTL while processEvent runs, then stops before release', async () => {
        const evalSpy = jest.spyOn(redisWrapper.client, 'eval');
        const listener = newListener({ lockTimeoutSec: 1, lockRenewIntervalMs: 200 });
        let lockDuringWork: string | null = 'unset';
        listener.work = async () => {
            await sleep(1500);
            lockDuringWork = await redisWrapper.client.get(lockKey);
        };
        const msg = createFakeMessage(payload);

        await listener.onMessage(payload, msg);
        const renewedWhileRunning = renewCalls(evalSpy);
        await sleep(500);

        expect({
            acked: wasAcked(msg),
            lockHeldPastTtl: typeof lockDuringWork === 'string' && (lockDuringWork as string).length > 0,
            renewedAtLeast: renewedWhileRunning >= 5,
            renewalsAfterFinish: renewCalls(evalSpy) - renewedWhileRunning,
            lockAfter: await redisWrapper.client.get(lockKey),
        }).toEqual({ acked: true, lockHeldPastTtl: true, renewedAtLeast: true, renewalsAfterFinish: 0, lockAfter: null });
        evalSpy.mockRestore();
    });

    it('stops renewing (and logs) once the lock is taken by someone else; never renews the other owner', async () => {
        const listener = newListener({ lockTimeoutSec: 2, lockRenewIntervalMs: 100 });
        listener.work = async () => {
            await sleep(150);
            await redisWrapper.client.set(lockKey, 'other-pod@1#x', { EX: 1 });
            await sleep(1300);
        };

        await listener.onMessage(payload, createFakeMessage(payload));

        expect({
            // logged once: the heartbeat stopped instead of probing the lost lock every tick
            lockLostLogs: (logger.error as jest.Mock).mock.calls.filter(([m]) => String(m).includes('[LockHeartbeat] Lock lost')).length,
            // other owner's 1s TTL was not extended by our heartbeat
            otherOwnerLock: await redisWrapper.client.get(lockKey),
        }).toEqual({ lockLostLogs: 1, otherOwnerLock: null });
    });
});

describe('UC-1020 startLockHeartbeat', () => {
    it('a Redis error does not stop the heartbeat; the next tick renews again', async () => {
        await redisWrapper.client.set('k', 'me@1#f', { EX: 1 });
        const realEval = redisWrapper.client.eval.bind(redisWrapper.client);
        const evalSpy = jest.spyOn(redisWrapper.client, 'eval')
            .mockRejectedValueOnce(new Error('Redis connection lost'))
            .mockImplementation(realEval as never);

        const stop = startLockHeartbeat('k', 'me@1#f', '', 1, 100);
        await sleep(1300);
        stop();

        expect({
            warned: (logger.warn as jest.Mock).mock.calls.some(([m]) => String(m).includes('[LockHeartbeat] Lock heartbeat failed')),
            calls: evalSpy.mock.calls.length >= 3,
            lock: await redisWrapper.client.get('k'),
        }).toEqual({ warned: true, calls: true, lock: 'me@1#f' });
        evalSpy.mockRestore();
    });

    it('empty expected value matches by suffix (service copies with unknown owner)', async () => {
        await redisWrapper.client.set('k2', 'pod-a@7#fp', { EX: 1 });
        const stop = startLockHeartbeat('k2', '', '@7#fp', 1, 100);
        await sleep(1300);
        stop();

        expect(await redisWrapper.client.get('k2')).toBe('pod-a@7#fp');
    });
});
