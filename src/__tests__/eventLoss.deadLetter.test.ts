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
 * capped back-off, dead-letter records that stay valid for any thrown value, DLQ write error metric, indexes).
 * Since DLQ-H the processor replays a record through the listener that wrote it instead of publishing it to NATS
 * (deadLetter.targetedReplay.test.ts), so replays are measured on the listener's handler and on the dead-letter record.
 * RetryableListener, RetryManager, DeadLetterProcessorJob and the DeadLetter schema run
 * as production code; only Redis, Mongo and NATS are in-memory fakes. The fake save runs schema validation.
 */
import { Connection, Mongoose } from 'mongoose';
import { Message, Stan } from 'node-nats-streaming';
import { RetryableListener } from '../events/retryableListener';
import { DeadLetterProcessorJob } from '../jobs/deadLetterProcessor.job';
import { deadLetterReplayRegistry } from '../events/deadLetterReplayRegistry';
import { Event, Subjects } from '../common';
import { EventMetrics } from '../metrics/EventMetrics';
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
        eventDlqWriteErrorTotal: { inc: jest.fn() },
        eventDlqReplayTotal: { inc: jest.fn() },
    }
}));

const DEFAULT_RETRY_LIMIT = 5;
const LISTENER_KEY = `${Subjects.StockUpdated}|event-loss-test`;

interface StockCopyEvent extends Event {
    subject: Subjects.StockUpdated;
    data: { id: string; user: string; quantity: number; version: number };
}

class FailingStockCopyListener extends RetryableListener<StockCopyEvent> {
    subject: Subjects.StockUpdated = Subjects.StockUpdated;
    queueGroupName = 'event-loss-test';
    failing = true;
    attempts = 0;

    // Fails while `failing` is set, so a message of this listener is not processed; counts every attempt.
    protected async processEvent(): Promise<void> {
        this.attempts++;
        if (this.failing) {
            throw new Error('ECONNRESET: socket hang up while writing stock copy');
        }
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

function minutesUntilReplay(record: Record<string, unknown>, from: number): number {
    return ((record.nextRetryAt as Date).getTime() - from) / 60_000;
}

describe('#648 K-2 — DeadLetterProcessorJob replays records written by RetryableListener within the attempt budget', () => {
    let nats: ReturnType<typeof createFakeStan>;
    let clock: ReturnType<typeof useFakeClock>;
    const originalReplayEnabled = process.env.DEAD_LETTER_REPLAY_ENABLED;

    /**
     * Runs the processor every 31 minutes, handing each due dead-letter record to the still failing listener,
     * until the listener is no longer called. `afterReplay` runs after every replay.
     */
    async function replayUntilNothingIsDue(
        listener: FailingStockCopyListener,
        processor: DeadLetterProcessorInternals,
        maxCycles: number,
        afterReplay: () => void = () => undefined
    ) {
        for (let cycle = 0; cycle < maxCycles; cycle++) {
            await clock.advance(31 * 60_000);
            const attemptsBefore = listener.attempts;
            await processor.processPendingEvents();
            if (listener.attempts === attemptsBefore) return;
            afterReplay();
        }
    }

    beforeEach(() => {
        jest.clearAllMocks();
        (redisWrapper.client as unknown as InMemoryRedis).flushAll();
        process.env.DEAD_LETTER_REPLAY_ENABLED = 'true';
        clock = useFakeClock();
        nats = createFakeStan();
    });

    afterEach(() => {
        jest.useRealTimers();
        deadLetterReplayRegistry.clear();
        if (originalReplayEnabled === undefined) {
            delete process.env.DEAD_LETTER_REPLAY_ENABLED;
        } else {
            process.env.DEAD_LETTER_REPLAY_ENABLED = originalReplayEnabled;
        }
    });

    it('control: a queued dead-letter record with retryCount 0 is replayed through its listener and completed', async () => {
        const deadLetters = createDeadLetterStore();
        const listener = new FailingStockCopyListener(nats.client, {}, deadLetters.connection);
        listener.failing = false;
        listener.listen();
        const record = deadLetters.seed({
            subject: Subjects.StockUpdated,
            eventId: 'stock-1',
            data: payload,
            error: 'manual seed',
            retryCount: 0,
            maxRetries: DEFAULT_RETRY_LIMIT,
            status: 'queued',
            listenerKey: LISTENER_KEY,
            queueGroupName: 'event-loss-test',
            service: 'inventory',
            nextRetryAt: new Date(Date.now() - 1000),
            timestamp: new Date(),
        });
        const processor = new DeadLetterProcessorJob(nats.client, deadLetters.connection) as unknown as DeadLetterProcessorInternals;

        await processor.processPendingEvents();

        expect({ attempts: listener.attempts, published: nats.publish.mock.calls.length, status: record.status })
            .toEqual({ attempts: 1, published: 0, status: 'completed' });
    });

    it('K-2: a record dead-lettered by the listener after exhausting retries must be replayed by the processor', async () => {
        const deadLetters = createDeadLetterStore();
        const listener = new FailingStockCopyListener(nats.client, {}, deadLetters.connection);
        listener.listen();
        const msg = createFakeMessage(payload);

        await redeliver(listener, msg, DEFAULT_RETRY_LIMIT);
        // Precondition: the listener dead-lettered and acked the message exactly as in production.
        expect(msg.ack).toHaveBeenCalledTimes(1);
        expect(deadLetters.collection.docs).toHaveLength(1);
        const [record] = deadLetters.collection.docs;
        expect(record).toMatchObject({ subject: Subjects.StockUpdated, status: 'queued', retryCount: DEFAULT_RETRY_LIMIT, listenerKey: LISTENER_KEY });

        // The listener schedules the replay one minute later; run the processor well after that, once the cause is gone.
        listener.failing = false;
        await clock.advance(2 * 60_000);
        const processor = new DeadLetterProcessorJob(nats.client, deadLetters.connection) as unknown as DeadLetterProcessorInternals;
        await processor.processPendingEvents();

        expect({ attempts: listener.attempts, published: nats.publish.mock.calls.length, status: record.status })
            .toEqual({ attempts: DEFAULT_RETRY_LIMIT + 1, published: 0, status: 'completed' });
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

    it('G3: a message that keeps failing is replayed deadLetterMaxRetries times on the same record, then marked failed instead of looping', async () => {
        const deadLetterMaxRetries = 5;
        const deadLetters = createDeadLetterStore();
        const listener = new FailingStockCopyListener(nats.client, { deadLetterMaxRetries }, deadLetters.connection);
        listener.listen();
        const processor = new DeadLetterProcessorJob(nats.client, deadLetters.connection) as unknown as DeadLetterProcessorInternals;
        await redeliver(listener, createFakeMessage(payload), DEFAULT_RETRY_LIMIT);

        await replayUntilNothingIsDue(listener, processor, 3 * deadLetterMaxRetries);

        expect(listener.attempts).toBe(DEFAULT_RETRY_LIMIT + deadLetterMaxRetries);
        expect(nats.publish).not.toHaveBeenCalled();
        expect(deadLetters.collection.docs).toHaveLength(1);
        expect(deadLetters.collection.docs[0]).toMatchObject({
            status: 'failed',
            retryCount: DEFAULT_RETRY_LIMIT + deadLetterMaxRetries,
            maxRetries: DEFAULT_RETRY_LIMIT + deadLetterMaxRetries,
        });
    });

    it('G3: dead-letter replays are scheduled 1, 2, 4, 8 and 16 minutes apart, capped at 30 minutes', async () => {
        const deadLetterMaxRetries = 7;
        const deadLetters = createDeadLetterStore();
        const listener = new FailingStockCopyListener(nats.client, { deadLetterMaxRetries }, deadLetters.connection);
        listener.listen();
        const processor = new DeadLetterProcessorJob(nats.client, deadLetters.connection) as unknown as DeadLetterProcessorInternals;
        await redeliver(listener, createFakeMessage(payload), DEFAULT_RETRY_LIMIT);
        const [record] = deadLetters.collection.docs;
        const scheduled = [minutesUntilReplay(record, (record.timestamp as Date).getTime())];

        await replayUntilNothingIsDue(listener, processor, 3 * deadLetterMaxRetries, () => {
            if (record.status === 'queued') scheduled.push(minutesUntilReplay(record, Date.now()));
        });

        expect(scheduled).toEqual([1, 2, 4, 8, 16, 30, 30]);
        expect(record.status).toBe('failed');
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

    it('G3: a replay that fails again is retried within 30 minutes on the same record and fails once the budget is used up', async () => {
        const deadLetters = createDeadLetterStore();
        const listener = new FailingStockCopyListener(nats.client, {}, deadLetters.connection);
        listener.listen();
        const record = deadLetters.seed({
            subject: Subjects.StockUpdated,
            eventId: 'stock-1',
            data: payload,
            error: 'ECONNRESET',
            retryCount: 8,
            maxRetries: 10,
            status: 'queued',
            listenerKey: LISTENER_KEY,
            queueGroupName: 'event-loss-test',
            service: 'inventory',
            nextRetryAt: new Date(Date.now() - 1000),
            timestamp: new Date(),
        });
        const processor = new DeadLetterProcessorJob(nats.client, deadLetters.connection) as unknown as DeadLetterProcessorInternals;

        await processor.processPendingEvents();
        expect(record).toMatchObject({ status: 'queued', retryCount: 9 });
        expect((record.nextRetryAt as Date).getTime() - Date.now()).toBeLessThanOrEqual(30 * 60_000);

        await clock.advance(30 * 60_000);
        await processor.processPendingEvents();
        expect(record).toMatchObject({ status: 'failed', retryCount: 10 });
        expect({ attempts: listener.attempts, records: deadLetters.collection.docs.length, published: nats.publish.mock.calls.length })
            .toEqual({ attempts: 2, records: 1, published: 0 });
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
        expect(EventMetrics.eventDlqWriteErrorTotal.inc).not.toHaveBeenCalled();
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

    it('G3: every exhausted delivery whose dead-letter record cannot be written is counted as an unavailable DLQ write', async () => {
        const deadLetters = createDeadLetterStore({ readyState: 0 });
        const listener = new FailingStockCopyListener(nats.client, {}, deadLetters.connection);
        const msg = createFakeMessage(payload);

        await redeliver(listener, msg, DEFAULT_RETRY_LIMIT + 2);

        expect(wasAcked(msg)).toBe(false);
        expect((EventMetrics.eventDlqWriteErrorTotal.inc as jest.Mock).mock.calls).toEqual(
            Array.from({ length: 3 }, () => [{ service: 'unknown', event_type: Subjects.StockUpdated, reason: 'unavailable' }])
        );
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
        expect(deadLetters.collection.docs[0]).toMatchObject({ error: 'Error', status: 'queued' });
    });

    it('G3: a thrown value that is not an Error is retried, dead-lettered with its text and acked', async () => {
        const deadLetters = createDeadLetterStore();
        const listener = new ThrowingStockCopyListener(nats.client, 'stock copy rejected', deadLetters.connection);
        const msg = createFakeMessage(payload);

        const deliveries = await redeliver(listener, msg, 3 * DEFAULT_RETRY_LIMIT);

        expect({ deliveries, acked: wasAcked(msg) }).toEqual({ deliveries: DEFAULT_RETRY_LIMIT, acked: true });
        expect(deadLetters.collection.docs).toHaveLength(1);
        expect(deadLetters.collection.docs[0]).toMatchObject({ error: 'stock copy rejected', status: 'queued' });
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
        expect((EventMetrics.eventDlqWriteErrorTotal.inc as jest.Mock).mock.calls).toEqual([
            [{ service: 'unknown', event_type: Subjects.StockUpdated, reason: 'invalid' }],
        ]);
    });
});

describe('#648 K-2 — DeadLetter schema indexes', () => {
    it('G3: the replay claim query of DeadLetterProcessorJob (status, environment, listenerKey, nextRetryAt) has an index', () => {
        const offline = new Mongoose();
        const indexedFields = createDeadLetterModel(offline.connection).schema.indexes().map(([fields]) => fields);

        expect(indexedFields).toContainEqual({ status: 1, environment: 1, listenerKey: 1, nextRetryAt: 1 });
    });
});
