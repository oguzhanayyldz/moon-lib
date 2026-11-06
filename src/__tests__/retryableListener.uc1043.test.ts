/**
 * UC-1043 — RetryableListener: permanent (deterministic) errors.
 *
 * - failFastOnPermanentError (default false = behaviour unchanged): a permanent error (isDeterministicEventError, the same
 *   name list as the service-level classifications UC-1013/1023/1025) skips NATS redelivery: 'failed' DLQ record + ack
 *   on the first delivery. Transient/unknown errors keep the old path (redelivery, then 'queued' DLQ).
 * - Shadow mode (flag off): permanent errors are counted (outcome 'shadow') and marked; a later successful redelivery of
 *   the same event is counted as 'recovered' (a false positive fail-fast would have dropped).
 * RetryableListener and RetryManager run as production code; Redis is the in-memory fake, NATS and Mongo are fakes.
 */
import { Message } from 'node-nats-streaming';
import { RetryableListener, resolveFailFastOnPermanentError } from '../events/retryableListener';
import { Event, Subjects } from '../common';
import { EventMetrics } from '../metrics/EventMetrics';
import { redisWrapper } from '../services/redisWrapper.service';
import { InMemoryRedis } from '../test/fakes/inMemoryRedis';
import { createDeadLetterStore, createFakeMessage, createFakeStan, wasAcked } from '../test/fakes/eventDeliveryHarness';
import { envScopedKey } from '../utils/redisEnvScope.util';
import { isDeterministicEventError } from '../utils/eventErrorClassification.util';

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
        eventPermanentErrorTotal: { inc: jest.fn() },
    }
}));

interface StockEvent extends Event {
    subject: Subjects.OrderUpdated;
    data: { id: string; version: number };
}

const payload: StockEvent['data'] = { id: 'order-7', version: 3 };
const eventId = `stock-${payload.id}`;
const retryKey = envScopedKey(`event:retry:${Subjects.OrderUpdated}:${eventId}`);
const shadowKey = envScopedKey(`event:permanent-shadow:${Subjects.OrderUpdated}:${eventId}`);

const typeError = () => new TypeError("Cannot read properties of undefined (reading 'quantity')");
const castError = () => Object.assign(new Error('Cast to ObjectId failed for value "x"'), { name: 'CastError' });
const notFound = () => new Error('Order not found: order-7');
const refused = () => Object.assign(new Error('connect ECONNREFUSED 10.43.0.10:27017'), { name: 'MongoNetworkError' });

/** Throws the queued errors one by one, then succeeds. */
class StockListener extends RetryableListener<StockEvent> {
    subject: Subjects.OrderUpdated = Subjects.OrderUpdated;
    queueGroupName = 'uc1043-test';
    calls = 0;
    errors: unknown[] = [];

    protected async processEvent(): Promise<void> {
        this.calls++;
        if (this.errors.length > 0) {
            throw this.errors.shift();
        }
    }

    protected getEventId(data: StockEvent['data']): string {
        return `stock-${data.id}`;
    }
}

const permanentMetric = () => (EventMetrics.eventPermanentErrorTotal.inc as jest.Mock).mock.calls.map(([labels]) => labels.outcome);

function newListener(options: ConstructorParameters<typeof RetryableListener>[1] = {}, store = createDeadLetterStore()) {
    const listener = new StockListener(createFakeStan().client, options, store.connection);
    return { listener, deadLetters: store };
}

function redelivery(msg: Message, redelivered: boolean): Message {
    (msg.isRedelivered as jest.Mock).mockReturnValue(redelivered);
    return msg;
}

/** Delivers the same NATS message until it is acked (at most `max` times). Returns the delivery count. */
async function deliverUntilAcked(listener: StockListener, msg: Message, max = 10): Promise<number> {
    for (let delivery = 1; delivery <= max; delivery++) {
        await listener.onMessage(payload, redelivery(msg, delivery > 1));
        if (wasAcked(msg)) return delivery;
    }
    return max;
}

beforeEach(() => {
    jest.clearAllMocks();
    (redisWrapper.client as unknown as InMemoryRedis).flushAll();
    delete process.env.RETRYABLE_PERMANENT_FAIL_FAST;
});

afterAll(() => {
    delete process.env.RETRYABLE_PERMANENT_FAIL_FAST;
});

describe('UC-1043 resolveFailFastOnPermanentError', () => {
    it.each([
        [undefined, undefined, false],
        [true, undefined, true],
        [false, 'true', false],
        [undefined, 'true', true],
        [undefined, '1', true],
        [undefined, ' TRUE ', true],
        [undefined, 'yes', false],
        [undefined, '0', false],
        [undefined, '', false],
    ])('explicit %p, env %p → %p', (explicit, env, expected) => {
        if (env !== undefined) process.env.RETRYABLE_PERMANENT_FAIL_FAST = env;
        expect(resolveFailFastOnPermanentError(explicit as boolean | undefined)).toBe(expected);
    });
});

describe('UC-1043 isDeterministicEventError', () => {
    it.each([
        ['TypeError', typeError(), true],
        ['CastError', castError(), true],
        ['ValidationError', Object.assign(new Error('v'), { name: 'ValidationError' }), true],
        ['RangeError', new RangeError('r'), true],
        ['plain Error "not found" (race, fixed by redelivery)', notFound(), false],
        ['MongoNetworkError', refused(), false],
        ['MongoServerError E11000', Object.assign(new Error('E11000'), { name: 'MongoServerError', code: 11000 }), false],
        ['string throw', 'boom', false],
        ['null', null, false],
    ])('%s → %p', (_label, error, expected) => {
        expect(isDeterministicEventError(error)).toBe(expected);
    });
});

describe('UC-1043 failFastOnPermanentError on', () => {
    it('TypeError: first delivery writes a "failed" DLQ record and acks, no redelivery', async () => {
        const { listener, deadLetters } = newListener({ failFastOnPermanentError: true });
        listener.errors = [typeError()];
        const msg = createFakeMessage(payload);

        await listener.onMessage(payload, msg);

        expect({ calls: listener.calls, acked: wasAcked(msg), metric: permanentMetric(), dlqRecords: deadLetters.collection.docs.length })
            .toEqual({ calls: 1, acked: true, metric: ['failed_fast'], dlqRecords: 1 });
        expect(deadLetters.collection.docs[0]).toMatchObject({
            status: 'failed',
            eventId,
            retryCount: 1,
            error: "Cannot read properties of undefined (reading 'quantity')",
        });
        expect(EventMetrics.eventRetryTotal.inc).not.toHaveBeenCalled();
        expect(EventMetrics.eventDlqTotal.inc).toHaveBeenCalledTimes(1);
    });

    it('enabled through RETRYABLE_PERMANENT_FAIL_FAST=true', async () => {
        process.env.RETRYABLE_PERMANENT_FAIL_FAST = 'true';
        const { listener, deadLetters } = newListener();
        listener.errors = [castError()];
        const msg = createFakeMessage(payload);

        await listener.onMessage(payload, msg);

        expect({ acked: wasAcked(msg), status: deadLetters.collection.docs.map(d => d.status) })
            .toEqual({ acked: true, status: ['failed'] });
    });

    it('transient error keeps the old path: redelivered maxRetries times, then a "queued" DLQ record', async () => {
        const { listener, deadLetters } = newListener({ failFastOnPermanentError: true });
        listener.errors = Array.from({ length: 10 }, refused);
        const msg = createFakeMessage(payload);

        const deliveries = await deliverUntilAcked(listener, msg);

        expect({ deliveries, metric: permanentMetric(), status: deadLetters.collection.docs.map(d => d.status) })
            .toEqual({ deliveries: 5, metric: [], status: ['queued'] });
    });

    it('unknown error ("not found", an out-of-order event) is NOT permanent: redelivered and succeeds', async () => {
        const { listener, deadLetters } = newListener({ failFastOnPermanentError: true });
        listener.errors = [notFound(), notFound()];
        const msg = createFakeMessage(payload);

        const deliveries = await deliverUntilAcked(listener, msg);

        expect({ deliveries, calls: listener.calls, dlqRecords: deadLetters.collection.docs.length, metric: permanentMetric() })
            .toEqual({ deliveries: 3, calls: 3, dlqRecords: 0, metric: [] });
    });

    it('DLQ unavailable: not acked, NATS redelivers (no message loss)', async () => {
        const { listener, deadLetters } = newListener({ failFastOnPermanentError: true }, createDeadLetterStore({ readyState: 0 }));
        listener.errors = [typeError()];
        const msg = createFakeMessage(payload);

        await listener.onMessage(payload, msg);

        expect({ acked: wasAcked(msg), dlqRecords: deadLetters.collection.docs.length }).toEqual({ acked: false, dlqRecords: 0 });
        expect((EventMetrics.eventDlqWriteErrorTotal.inc as jest.Mock).mock.calls[0][0]).toMatchObject({ reason: 'unavailable' });
    });

    it('DLQ record invalid (ValidationError on save): logged and acked, never redelivered forever', async () => {
        const saveError = Object.assign(new Error('DeadLetter validation failed'), { name: 'ValidationError' });
        const { listener } = newListener({ failFastOnPermanentError: true }, createDeadLetterStore({ saveError }));
        listener.errors = [typeError()];
        const msg = createFakeMessage(payload);

        await listener.onMessage(payload, msg);

        expect(wasAcked(msg)).toBe(true);
        expect((EventMetrics.eventDlqWriteErrorTotal.inc as jest.Mock).mock.calls[0][0]).toMatchObject({ reason: 'invalid' });
    });

    it('enableDeadLetter false: permanent error is acked on the first delivery without a record', async () => {
        const { listener, deadLetters } = newListener({ failFastOnPermanentError: true, enableDeadLetter: false });
        listener.errors = [typeError()];
        const msg = createFakeMessage(payload);

        await listener.onMessage(payload, msg);

        expect({ calls: listener.calls, acked: wasAcked(msg), dlqRecords: deadLetters.collection.docs.length })
            .toEqual({ calls: 1, acked: true, dlqRecords: 0 });
    });

    it('works with enableLock false too', async () => {
        const { listener, deadLetters } = newListener({ failFastOnPermanentError: true, enableLock: false });
        listener.errors = [typeError()];
        const msg = createFakeMessage(payload);

        await listener.onMessage(payload, msg);

        expect({ acked: wasAcked(msg), status: deadLetters.collection.docs.map(d => d.status) })
            .toEqual({ acked: true, status: ['failed'] });
    });
});

describe('UC-1043 shadow mode (default, flag off)', () => {
    it('permanent error keeps the old path: 5 deliveries, "queued" DLQ record, counted as shadow on every delivery', async () => {
        const { listener, deadLetters } = newListener();
        listener.errors = Array.from({ length: 10 }, typeError);
        const msg = createFakeMessage(payload);

        const deliveries = await deliverUntilAcked(listener, msg);

        expect({ deliveries, metric: permanentMetric(), status: deadLetters.collection.docs.map(d => d.status) })
            .toEqual({ deliveries: 5, metric: ['shadow', 'shadow', 'shadow', 'shadow', 'shadow'], status: ['queued'] });
        expect(await redisWrapper.client.get(shadowKey)).toBe('1');
    });

    it('permanent-classified event that succeeds on redelivery is counted as recovered (false positive) and unmarked', async () => {
        const { listener } = newListener();
        listener.errors = [typeError()];
        const msg = createFakeMessage(payload);

        const deliveries = await deliverUntilAcked(listener, msg);

        expect({ deliveries, metric: permanentMetric(), shadow: await redisWrapper.client.get(shadowKey), retryCounter: await redisWrapper.client.get(retryKey) })
            .toEqual({ deliveries: 2, metric: ['shadow', 'recovered'], shadow: null, retryCounter: null });
    });

    it('recovered is counted on the lock-less path too', async () => {
        const { listener } = newListener({ enableLock: false });
        listener.errors = [castError()];
        const msg = createFakeMessage(payload);

        await deliverUntilAcked(listener, msg);

        expect(permanentMetric()).toEqual(['shadow', 'recovered']);
    });

    it('shadow-marked event that reached the DLQ and succeeds on replay is counted as recovered', async () => {
        const { listener } = newListener();
        listener.errors = Array.from({ length: 5 }, typeError);
        const msg = createFakeMessage(payload);
        await deliverUntilAcked(listener, msg);

        const result = await listener.replayDeadLetter(payload);

        expect({ result, metric: permanentMetric().slice(-1), shadow: await redisWrapper.client.get(shadowKey) })
            .toEqual({ result: 'processed', metric: ['recovered'], shadow: null });
    });

    it('a first-time success (not redelivered) never reads or counts recovered', async () => {
        const { listener } = newListener();
        await (redisWrapper.client as unknown as InMemoryRedis).set(shadowKey, '1');
        const msg = createFakeMessage(payload);

        await listener.onMessage(payload, msg);

        expect({ acked: wasAcked(msg), metric: permanentMetric(), shadow: await redisWrapper.client.get(shadowKey) })
            .toEqual({ acked: true, metric: [], shadow: '1' });
    });

    it('a redelivered success without a shadow mark is not counted', async () => {
        const { listener } = newListener();
        listener.errors = [refused()];
        const msg = createFakeMessage(payload);

        await deliverUntilAcked(listener, msg);

        expect(permanentMetric()).toEqual([]);
    });

    it('Redis failure while marking/unmarking the shadow never changes the message outcome', async () => {
        const { listener } = newListener();
        listener.errors = [typeError()];
        const client = redisWrapper.client as unknown as InMemoryRedis;
        const realSet = client.set.bind(client);
        const realDel = client.del.bind(client);
        const setSpy = jest.spyOn(client, 'set').mockImplementation(async (key: string, value: string, options?: any) => {
            if (key === shadowKey) throw new Error('redis down');
            return realSet(key, value, options);
        });
        const delSpy = jest.spyOn(client, 'del').mockImplementation(async (key: string) => {
            if (key === shadowKey) throw new Error('redis down');
            return realDel(key);
        });
        const msg = createFakeMessage(payload);

        try {
            const deliveries = await deliverUntilAcked(listener, msg);
            expect({ deliveries, calls: listener.calls }).toEqual({ deliveries: 2, calls: 2 });
        } finally {
            setSpy.mockRestore();
            delSpy.mockRestore();
        }
    });
});
