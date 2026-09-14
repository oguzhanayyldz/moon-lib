/**
 * Issue #648 · 648-G1 reproduction — dead-letter queue paths. Line numbers refer to moon-lib 11677f7 (before 648-G3).
 *
 * K-2: RetryableListener writes the DLQ record with the exhausted retry count
 *      (events/retryableListener.ts:366-376, retryCount >= 5), while
 *      DeadLetterProcessorJob only picks `retryCount < 5` (jobs/deadLetterProcessor.job.ts:83-87).
 *      The `maxRetries` option is logged but never reaches RetryManager
 *      (retryableListener.ts:48, services/retryManager.ts:20-23,60-63), so the limit is always 5.
 * K-3: when Mongo is not ready (retryableListener.ts:358-361) or the DLQ save throws
 *      (:301-304), the exhausted message is still acked (:307).
 *
 * Tests marked "K-2:" / "K-3:" failed on 11677f7 and pass with the 648-G3 fix; tests marked "G3:"
 * pin the behaviour of that fix (bounded replay, replay back-off schedule, no automatic replay of old records,
 * capped back-off, dead-letter records that stay valid for any thrown value, indexes).
 * RetryableListener, RetryManager, DeadLetterProcessorJob and the DeadLetter schema run
 * as production code; only Redis, Mongo and NATS are in-memory fakes. The fake save runs schema validation.
 */
import { Connection, Mongoose } from 'mongoose';
import { Message, Stan } from 'node-nats-streaming';
import { RetryableListener } from '../events/retryableListener';
import { DeadLetterProcessorJob } from '../jobs/deadLetterProcessor.job';
import { Event, Subjects } from '../common';
import { createDeadLetterModel } from '../models/deadLetter.schema';
import { logger } from '../services/logger.service';
import { redisWrapper } from '../services/redisWrapper.service';
import { InMemoryRedis } from '../test/fakes/inMemoryRedis';
import {
    NOT_LOST,
    createDeadLetterStore,
    createFakeMessage,
    createFakeStan,
    deliveryOutcome,
    useFakeClock,
    wasAcked,
} from '../test/fakes/eventDeliveryHarness';

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
    }
}));

const DEFAULT_RETRY_LIMIT = 5;

interface StockCopyEvent extends Event {
    subject: Subjects.StockUpdated;
    data: { id: string; user: string; quantity: number; version: number };
}

class FailingStockCopyListener extends RetryableListener<StockCopyEvent> {
    subject: Subjects.StockUpdated = Subjects.StockUpdated;
    queueGroupName = 'event-loss-test';

    // Always fails, so a message of this listener is never processed.
    protected async processEvent(): Promise<void> {
        throw new Error('ECONNRESET: socket hang up while writing stock copy');
    }

    protected getEventId(data: StockCopyEvent['data']): string {
        return `stock-${data.id}`;
    }
}

/** Fails with the value it was given, which is not always an Error with a message. */
class ThrowingStockCopyListener extends RetryableListener<StockCopyEvent> {
    subject: Subjects.StockUpdated = Subjects.StockUpdated;
    queueGroupName = 'event-loss-test';

    constructor (client: Stan, private readonly thrown: unknown, connection: Connection) {
        super(client, {}, connection);
    }

    protected async processEvent(): Promise<void> {
        throw this.thrown;
    }

    protected getEventId(data: StockCopyEvent['data']): string {
        return `stock-${data.id}`;
    }
}

type DeadLetterProcessorInternals = { processPendingEvents(): Promise<void> };

const payload: StockCopyEvent['data'] = { id: 'stock-1', user: 'user-1', quantity: 4, version: 3 };

/** NATS Streaming redelivers an un-acked message after ackWait; the test replays that sequence. Returns the number of deliveries. */
async function redeliver(listener: RetryableListener<StockCopyEvent>, msg: Message, deliveries: number): Promise<number> {
    let delivered = 0;
    while (delivered < deliveries && !wasAcked(msg)) {
        delivered++;
        await listener.onMessage(payload, msg);
    }
    return delivered;
}

function minutesUntilReplay(record: Record<string, unknown>): number {
    return ((record.nextRetryAt as Date).getTime() - (record.timestamp as Date).getTime()) / 60_000;
}

describe('#648 K-2 — DeadLetterProcessorJob replays records written by RetryableListener within the attempt budget', () => {
    let nats: ReturnType<typeof createFakeStan>;
    let clock: ReturnType<typeof useFakeClock>;

    /**
     * Publishes every due dead-letter record and delivers it to the still failing listener, which dead-letters
     * it again, until the processor has nothing left to publish.
     */
    async function replayUntilNothingIsDue(listener: FailingStockCopyListener, processor: DeadLetterProcessorInternals, maxCycles: number) {
        for (let cycle = 0; cycle < maxCycles; cycle++) {
            await clock.advance(31 * 60_000);
            const publishedBefore = nats.publish.mock.calls.length;
            await processor.processPendingEvents();
            if (nats.publish.mock.calls.length === publishedBefore) return;

            const replayed = createFakeMessage(payload);
            await listener.onMessage(payload, replayed);
            expect(wasAcked(replayed)).toBe(true);
        }
    }

    beforeEach(() => {
        jest.clearAllMocks();
        (redisWrapper.client as unknown as InMemoryRedis).flushAll();
        clock = useFakeClock();
        nats = createFakeStan();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('control: a pending dead-letter record with retryCount 0 is republished to NATS', async () => {
        const deadLetters = createDeadLetterStore();
        const record = deadLetters.seed({
            subject: Subjects.StockUpdated,
            eventId: 'stock-1',
            data: payload,
            error: 'manual seed',
            retryCount: 0,
            maxRetries: DEFAULT_RETRY_LIMIT,
            service: 'inventory',
            nextRetryAt: new Date(Date.now() - 1000),
            timestamp: new Date(),
        });
        const processor = new DeadLetterProcessorJob(nats.client, deadLetters.connection) as unknown as DeadLetterProcessorInternals;

        await processor.processPendingEvents();

        expect(nats.publish).toHaveBeenCalledWith(Subjects.StockUpdated, JSON.stringify(payload), expect.any(Function));
        expect(record.status).toBe('completed');
    });

    it('K-2: a record dead-lettered by the listener after exhausting retries must be republished by the processor', async () => {
        const deadLetters = createDeadLetterStore();
        const listener = new FailingStockCopyListener(nats.client, {}, deadLetters.connection);
        const msg = createFakeMessage(payload);

        await redeliver(listener, msg, DEFAULT_RETRY_LIMIT);
        // Precondition: the listener dead-lettered and acked the message exactly as in production.
        expect(msg.ack).toHaveBeenCalledTimes(1);
        expect(deadLetters.collection.docs).toHaveLength(1);
        const [record] = deadLetters.collection.docs;
        expect(record).toMatchObject({ subject: Subjects.StockUpdated, status: 'pending', retryCount: DEFAULT_RETRY_LIMIT });

        // The listener schedules the replay one minute later; run the processor well after that.
        await clock.advance(2 * 60_000);
        const processor = new DeadLetterProcessorJob(nats.client, deadLetters.connection) as unknown as DeadLetterProcessorInternals;
        await processor.processPendingEvents();

        expect(nats.publish).toHaveBeenCalledWith(Subjects.StockUpdated, JSON.stringify(payload), expect.any(Function));
        expect(record.status).toBe('completed');
    });

    it('K-2: the maxRetries option must bound the attempts before the message is dead-lettered', async () => {
        const maxRetries = 3;
        const deadLetters = createDeadLetterStore();
        const listener = new FailingStockCopyListener(nats.client, { maxRetries }, deadLetters.connection);
        const msg = createFakeMessage(payload);

        await redeliver(listener, msg, maxRetries);

        expect({ acked: wasAcked(msg), deadLetterRecords: deadLetters.collection.docs.length })
            .toEqual({ acked: true, deadLetterRecords: 1 });
    });

    it('G3: a message that keeps failing is replayed deadLetterMaxRetries times, then marked failed instead of looping', async () => {
        const deadLetterMaxRetries = 5;
        const deadLetters = createDeadLetterStore();
        const listener = new FailingStockCopyListener(nats.client, { deadLetterMaxRetries }, deadLetters.connection);
        const processor = new DeadLetterProcessorJob(nats.client, deadLetters.connection) as unknown as DeadLetterProcessorInternals;
        await redeliver(listener, createFakeMessage(payload), DEFAULT_RETRY_LIMIT);

        await replayUntilNothingIsDue(listener, processor, 3 * deadLetterMaxRetries);

        expect(nats.publish).toHaveBeenCalledTimes(deadLetterMaxRetries);
        const records = deadLetters.collection.docs;
        expect(records).toHaveLength(1 + deadLetterMaxRetries);
        expect(records.slice(0, -1).every(record => record.status === 'completed')).toBe(true);
        expect(records[records.length - 1]).toMatchObject({
            status: 'failed',
            retryCount: DEFAULT_RETRY_LIMIT + deadLetterMaxRetries,
            maxRetries: DEFAULT_RETRY_LIMIT + deadLetterMaxRetries,
        });
    });

    it('G3: dead-letter replays are scheduled 1, 2, 4, 8 and 16 minutes apart, capped at 30 minutes', async () => {
        const deadLetterMaxRetries = 7;
        const deadLetters = createDeadLetterStore();
        const listener = new FailingStockCopyListener(nats.client, { deadLetterMaxRetries }, deadLetters.connection);
        const processor = new DeadLetterProcessorJob(nats.client, deadLetters.connection) as unknown as DeadLetterProcessorInternals;
        await redeliver(listener, createFakeMessage(payload), DEFAULT_RETRY_LIMIT);

        await replayUntilNothingIsDue(listener, processor, 3 * deadLetterMaxRetries);

        const replayable = deadLetters.collection.docs.filter(record => record.status !== 'failed');
        expect(replayable.map(minutesUntilReplay)).toEqual([1, 2, 4, 8, 16, 30, 30]);
    });

    it('G3: a pending record written before the fix (retryCount >= maxRetries) is not replayed automatically', async () => {
        const deadLetters = createDeadLetterStore();
        const record = deadLetters.seed({
            subject: Subjects.StockUpdated,
            eventId: 'stock-1',
            data: payload,
            error: 'written by the listener before 648-G3',
            retryCount: DEFAULT_RETRY_LIMIT,
            maxRetries: DEFAULT_RETRY_LIMIT,
            service: 'inventory',
            nextRetryAt: new Date(Date.now() - 1000),
            timestamp: new Date(),
        });
        const processor = new DeadLetterProcessorJob(nats.client, deadLetters.connection) as unknown as DeadLetterProcessorInternals;

        await processor.processPendingEvents();

        expect(nats.publish).not.toHaveBeenCalled();
        expect(record.status).toBe('pending');
    });

    it('G3: a replay whose publish fails is retried within 30 minutes and fails once the budget is used up', async () => {
        const deadLetters = createDeadLetterStore();
        const record = deadLetters.seed({
            subject: Subjects.StockUpdated,
            eventId: 'stock-1',
            data: payload,
            error: 'ECONNRESET',
            retryCount: 8,
            maxRetries: 10,
            service: 'inventory',
            nextRetryAt: new Date(Date.now() - 1000),
            timestamp: new Date(),
        });
        const processor = new DeadLetterProcessorJob(nats.client, deadLetters.connection) as unknown as DeadLetterProcessorInternals;
        nats.setPublishFails(true);

        await processor.processPendingEvents();
        expect(record).toMatchObject({ status: 'pending', retryCount: 9 });
        expect((record.nextRetryAt as Date).getTime() - Date.now()).toBeLessThanOrEqual(30 * 60_000);

        await clock.advance(30 * 60_000);
        await processor.processPendingEvents();
        expect(record).toMatchObject({ status: 'failed', retryCount: 10 });
        expect(nats.publish).toHaveBeenCalledTimes(2);
    });
});

describe('#648 K-3 — RetryableListener: an exhausted message is not acked while its dead-letter record cannot be written', () => {
    let nats: ReturnType<typeof createFakeStan>;

    beforeEach(() => {
        jest.clearAllMocks();
        (redisWrapper.client as unknown as InMemoryRedis).flushAll();
        nats = createFakeStan();
    });

    it('control: with Mongo ready, the exhausted message is acked only after the dead-letter record is written', async () => {
        const deadLetters = createDeadLetterStore();
        const listener = new FailingStockCopyListener(nats.client, {}, deadLetters.connection);
        const msg = createFakeMessage(payload);

        await redeliver(listener, msg, DEFAULT_RETRY_LIMIT);

        expect(deliveryOutcome({
            acked: wasAcked(msg),
            processed: false,
            deadLettered: deadLetters.collection.docs.length > 0,
        })).toBe(NOT_LOST);
        expect(wasAcked(msg)).toBe(true);
    });

    it('K-3: when the Mongo connection is not ready the exhausted message must not be acked without a dead-letter record', async () => {
        const deadLetters = createDeadLetterStore({ readyState: 0 });
        const listener = new FailingStockCopyListener(nats.client, {}, deadLetters.connection);
        const msg = createFakeMessage(payload);

        await redeliver(listener, msg, DEFAULT_RETRY_LIMIT);

        expect(deliveryOutcome({
            acked: wasAcked(msg),
            processed: false,
            deadLettered: deadLetters.collection.docs.length > 0,
        })).toBe(NOT_LOST);
    });

    it('K-3: when saving the dead-letter record throws the exhausted message must not be acked', async () => {
        const deadLetters = createDeadLetterStore({ saveError: new Error('MongoNetworkError: connection 3 to mongo:27017 closed') });
        const listener = new FailingStockCopyListener(nats.client, {}, deadLetters.connection);
        const msg = createFakeMessage(payload);

        await redeliver(listener, msg, DEFAULT_RETRY_LIMIT);

        expect(deliveryOutcome({
            acked: wasAcked(msg),
            processed: false,
            deadLettered: deadLetters.collection.docs.length > 0,
        })).toBe(NOT_LOST);
    });
});

describe('#648 K-3 — RetryableListener: dead-letter records for errors that are not a plain Error with a message', () => {
    let nats: ReturnType<typeof createFakeStan>;
    const originalNodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
        jest.clearAllMocks();
        (redisWrapper.client as unknown as InMemoryRedis).flushAll();
        nats = createFakeStan();
    });

    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv;
    });

    it('G3: an Error without a message is dead-lettered with a non-empty error and acked', async () => {
        const deadLetters = createDeadLetterStore();
        const listener = new ThrowingStockCopyListener(nats.client, new Error(), deadLetters.connection);
        const msg = createFakeMessage(payload);

        const deliveries = await redeliver(listener, msg, 3 * DEFAULT_RETRY_LIMIT);

        expect({ deliveries, acked: wasAcked(msg) }).toEqual({ deliveries: DEFAULT_RETRY_LIMIT, acked: true });
        expect(deadLetters.collection.docs).toHaveLength(1);
        expect(deadLetters.collection.docs[0]).toMatchObject({ error: 'Error', status: 'pending' });
    });

    it('G3: a thrown value that is not an Error is retried, dead-lettered with its text and acked', async () => {
        const deadLetters = createDeadLetterStore();
        const listener = new ThrowingStockCopyListener(nats.client, 'stock copy rejected', deadLetters.connection);
        const msg = createFakeMessage(payload);

        const deliveries = await redeliver(listener, msg, 3 * DEFAULT_RETRY_LIMIT);

        expect({ deliveries, acked: wasAcked(msg) }).toEqual({ deliveries: DEFAULT_RETRY_LIMIT, acked: true });
        expect(deadLetters.collection.docs).toHaveLength(1);
        expect(deadLetters.collection.docs[0]).toMatchObject({ error: 'stock copy rejected', status: 'pending' });
    });

    it('G3: a dead-letter record that can never pass schema validation is acked with an error log instead of being redelivered forever', async () => {
        // The DeadLetter environment enum has no "staging", so every attempt to save the record fails validation.
        process.env.NODE_ENV = 'staging';
        const deadLetters = createDeadLetterStore();
        const listener = new FailingStockCopyListener(nats.client, {}, deadLetters.connection);
        const msg = createFakeMessage(payload);

        const deliveries = await redeliver(listener, msg, 3 * DEFAULT_RETRY_LIMIT);

        expect({ deliveries, acked: wasAcked(msg), deadLetterRecords: deadLetters.collection.docs.length })
            .toEqual({ deliveries: DEFAULT_RETRY_LIMIT, acked: true, deadLetterRecords: 0 });
        expect(logger.error).toHaveBeenCalledWith(
            expect.stringContaining(`can never be saved, acking without a DLQ record: ${Subjects.StockUpdated}:stock-stock-1`),
            expect.objectContaining({ name: 'ValidationError' })
        );
    });
});

describe('#648 K-2 — DeadLetter schema indexes', () => {
    it('G3: the pending query of DeadLetterProcessorJob (status, environment, nextRetryAt) has an index', () => {
        const offline = new Mongoose();
        const indexedFields = createDeadLetterModel(offline.connection).schema.indexes().map(([fields]) => fields);

        expect(indexedFields).toContainEqual({ status: 1, environment: 1, nextRetryAt: 1 });
    });
});
