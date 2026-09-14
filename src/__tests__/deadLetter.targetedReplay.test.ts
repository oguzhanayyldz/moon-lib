/**
 * Issue #648 · 648-G3 DLQ-H — targeted dead-letter replay.
 *
 * Before DLQ-H, DeadLetterProcessorJob replayed a record by publishing its data to the subject
 * (jobs/deadLetterProcessor.job.ts:139 at 9d13cf5). Every queue group subscribed to that subject received a copy,
 * so one service's failure was applied again by every other subscriber, and a replay that failed again
 * produced a new dead-letter record.
 *
 * Tests marked "DLQ-H1".."DLQ-H3" failed on 9d13cf5 and pass with targeted replay; the other tests pin the safety
 * properties of targeted replay (H4 unregistered keys, H5 two processors, H6 busy, H7 switch, H8 re-entrancy),
 * the per-cycle cap, the per-listener opt-out, stuck replays, the environment filter, the replay time limit,
 * the replay metric and RetryableListener.replayDeadLetter.
 * Two services share one fake NATS bus that tells queue groups apart; each service has its own DeadLetter store.
 * In production every service has its own Redis database, so the listeners of the two services use
 * service-prefixed event ids and never share a retry counter or lock in the single in-memory Redis.
 */
import { Message } from 'node-nats-streaming';
import { RetryableListener } from '../events/retryableListener';
import { DeadLetterProcessorJob } from '../jobs/deadLetterProcessor.job';
import { deadLetterReplayRegistry } from '../events/deadLetterReplayRegistry';
import { Event, Subjects } from '../common';
import { EventMetrics } from '../metrics/EventMetrics';
import { DeadLetterAttrs } from '../models/deadLetter.schema';
import { logger } from '../services/logger.service';
import { redisWrapper } from '../services/redisWrapper.service';
import { InMemoryRedis } from '../test/fakes/inMemoryRedis';
import {
    createDeadLetterStore,
    createFakeMessage,
    createFakeStanBus,
    trackInFlightMessages,
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

interface StockCopyEvent extends Event {
    subject: Subjects.StockUpdated;
    data: { id: string; user: string; quantity: number; version: number };
}

type DeadLetterProcessorInternals = { processPendingEvents(): Promise<void>; releaseStuckEvents(): Promise<void> };

/** svc-a: fails while `failing` is set. */
class FailingStockCopyListener extends RetryableListener<StockCopyEvent> {
    subject: Subjects.StockUpdated = Subjects.StockUpdated;
    queueGroupName = 'svc-a-stock-copy';
    failing = true;
    attempts = 0;
    readonly applied: StockCopyEvent['data'][] = [];

    protected async processEvent(data: StockCopyEvent['data']): Promise<void> {
        this.attempts++;
        if (this.failing) {
            throw new Error('ECONNRESET: socket hang up while writing stock copy');
        }
        this.applied.push(data);
    }

    protected getEventId(data: StockCopyEvent['data']): string {
        return `svc-a-stock-${data.id}-v${data.version}`;
    }
}

/**
 * svc-b: overwrites its copy without a version check, like
 * orders/src/events/listeners/productPriceUpdated.listener.ts:62 (`$set costPrice`).
 */
class StockMirrorListener extends RetryableListener<StockCopyEvent> {
    subject: Subjects.StockUpdated = Subjects.StockUpdated;
    queueGroupName = 'svc-b-stock-mirror';
    readonly applied: StockCopyEvent['data'][] = [];
    current: StockCopyEvent['data'] | null = null;

    protected async processEvent(data: StockCopyEvent['data']): Promise<void> {
        this.applied.push(data);
        this.current = data;
    }

    protected getEventId(data: StockCopyEvent['data']): string {
        return `svc-b-stock-${data.id}-v${data.version}`;
    }
}

/** svc-a listener whose processing waits until `release()` is called. */
class GatedStockCopyListener extends FailingStockCopyListener {
    started = 0;
    private open: () => void = () => undefined;
    private readonly gate = new Promise<void>(resolve => {
        this.open = resolve;
    });

    release(): void {
        this.open();
    }

    protected async processEvent(data: StockCopyEvent['data']): Promise<void> {
        this.started++;
        await this.gate;
        await super.processEvent(data);
    }
}

/** Gated svc-a listener whose first processing attempt fails once the gate opens; later attempts succeed. */
class FailFirstGatedListener extends GatedStockCopyListener {
    private calls = 0;

    protected async processEvent(data: StockCopyEvent['data']): Promise<void> {
        const firstCall = this.calls++ === 0;
        await super.processEvent(data);
        if (firstCall) {
            throw new Error('ECONNRESET: socket hang up while writing stock copy');
        }
    }
}

const stockV3: StockCopyEvent['data'] = { id: 'stock-1', user: 'user-1', quantity: 4, version: 3 };
const stockV4: StockCopyEvent['data'] = { id: 'stock-1', user: 'user-1', quantity: 9, version: 4 };
const SVC_A_KEY = `${Subjects.StockUpdated}|svc-a-stock-copy`;
const SVC_B_KEY = `${Subjects.StockUpdated}|svc-b-stock-mirror`;

/** Lets pending promise callbacks and in-memory store calls run until `condition` holds. */
async function waitUntil(condition: () => boolean): Promise<void> {
    for (let turn = 0; turn < 100 && !condition(); turn++) {
        await new Promise(resolve => setImmediate(resolve));
    }
    expect(condition()).toBe(true);
}

/** Lets pending promise callbacks run for a number of event loop turns. */
async function flushTurns(turns: number): Promise<void> {
    for (let turn = 0; turn < turns; turn++) {
        await new Promise(resolve => setImmediate(resolve));
    }
}

function restoreReplaySwitch(original: string | undefined): void {
    if (original === undefined) {
        delete process.env.DEAD_LETTER_REPLAY_ENABLED;
    } else {
        process.env.DEAD_LETTER_REPLAY_ENABLED = original;
    }
}

describe('#648 DLQ-H — a dead-letter record is replayed only in the queue group that failed', () => {
    let bus: ReturnType<typeof createFakeStanBus>;
    let clock: ReturnType<typeof useFakeClock>;
    const originalReplayEnabled = process.env.DEAD_LETTER_REPLAY_ENABLED;

    function createService() {
        const client = bus.connect();
        const deadLetters = createDeadLetterStore();
        const processor = new DeadLetterProcessorJob(client, deadLetters.connection) as unknown as DeadLetterProcessorInternals;
        return { client, deadLetters, processor };
    }

    /** Starts both services the way their index.ts does and records every onMessage call. */
    function startServices(options: { deadLetterMaxRetries?: number } = {}) {
        const svcA = createService();
        const svcB = createService();
        const failing = new FailingStockCopyListener(svcA.client, options, svcA.deadLetters.connection);
        const mirror = new StockMirrorListener(svcB.client, {}, svcB.deadLetters.connection);
        const inFlight = [failing, mirror].map(listener => trackInFlightMessages(listener));
        failing.listen();
        mirror.listen();
        expect(bus.queueGroups(Subjects.StockUpdated)).toEqual(['svc-a-stock-copy', 'svc-b-stock-mirror']);
        return { svcA, svcB, failing, mirror, settle: () => Promise.all(inFlight.flat()) };
    }

    function publish(data: StockCopyEvent['data']) {
        bus.publish(Subjects.StockUpdated, JSON.stringify(data), () => undefined);
    }

    /** NATS Streaming redelivers an un-acked message to the same queue group until it is acked. */
    async function redeliverUntilAcked(listener: FailingStockCopyListener, data: StockCopyEvent['data'], deliveries: number) {
        const msg: Message = createFakeMessage(data);
        for (let delivered = 0; delivered < deliveries && !wasAcked(msg); delivered++) {
            await listener.onMessage(data, msg);
        }
        return msg;
    }

    beforeEach(() => {
        jest.clearAllMocks();
        (redisWrapper.client as unknown as InMemoryRedis).flushAll();
        process.env.DEAD_LETTER_REPLAY_ENABLED = 'true';
        clock = useFakeClock();
        bus = createFakeStanBus();
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

    it('DLQ-H1: the replay of a svc-a dead-letter record is processed by svc-a only', async () => {
        const { svcA, failing, mirror, settle } = startServices();
        publish(stockV3);
        await settle();
        const exhausted = await redeliverUntilAcked(failing, stockV3, DEFAULT_RETRY_LIMIT - 1);
        // Precondition: svc-b applied the event once, svc-a dead-lettered it after exhausting its retries.
        expect({ acked: wasAcked(exhausted), records: svcA.deadLetters.collection.docs.length, appliedBySvcB: mirror.applied.length })
            .toEqual({ acked: true, records: 1, appliedBySvcB: 1 });
        const [record] = svcA.deadLetters.collection.docs;

        failing.failing = false;
        await clock.advance(2 * 60_000);
        const publishedBefore = bus.publish.mock.calls.length;
        await svcA.processor.processPendingEvents();
        await settle();

        expect({
            appliedBySvcA: failing.applied.length,
            appliedBySvcB: mirror.applied.length,
            republishedToNats: bus.publish.mock.calls.length - publishedBefore,
            recordStatus: record.status,
        }).toEqual({ appliedBySvcA: 1, appliedBySvcB: 1, republishedToNats: 0, recordStatus: 'completed' });
    });

    it('DLQ-H2: a stale replay of a svc-a dead-letter record does not overwrite the newer state of svc-b', async () => {
        const { svcA, failing, mirror, settle } = startServices();
        publish(stockV3);
        await settle();
        await redeliverUntilAcked(failing, stockV3, DEFAULT_RETRY_LIMIT - 1);
        expect(svcA.deadLetters.collection.docs).toHaveLength(1);

        // svc-b receives the next version before svc-a's record is due.
        publish(stockV4);
        await settle();
        expect(mirror.current?.version).toBe(stockV4.version);

        await clock.advance(2 * 60_000);
        await svcA.processor.processPendingEvents();
        await settle();

        expect({ svcBVersion: mirror.current?.version, appliedBySvcB: mirror.applied.map(data => data.version) })
            .toEqual({ svcBVersion: stockV4.version, appliedBySvcB: [stockV3.version, stockV4.version] });
    });

    it('DLQ-H3: a replay that fails again updates the same dead-letter record and publishes nothing', async () => {
        const deadLetterMaxRetries = 5;
        const { svcA, failing, mirror, settle } = startServices({ deadLetterMaxRetries });
        publish(stockV3);
        await settle();
        await redeliverUntilAcked(failing, stockV3, DEFAULT_RETRY_LIMIT - 1);
        const publishedBefore = bus.publish.mock.calls.length;

        for (let cycle = 0; cycle < 3 * deadLetterMaxRetries; cycle++) {
            await clock.advance(31 * 60_000);
            await svcA.processor.processPendingEvents();
            await settle();
        }

        expect({
            deadLetterRecords: svcA.deadLetters.collection.docs.length,
            recordStatus: svcA.deadLetters.collection.docs[0].status,
            recordRetryCount: svcA.deadLetters.collection.docs[0].retryCount,
            attemptsInSvcA: failing.attempts,
            appliedBySvcB: mirror.applied.length,
            republishedToNats: bus.publish.mock.calls.length - publishedBefore,
        }).toEqual({
            deadLetterRecords: 1,
            recordStatus: 'failed',
            recordRetryCount: DEFAULT_RETRY_LIMIT + deadLetterMaxRetries,
            attemptsInSvcA: DEFAULT_RETRY_LIMIT + deadLetterMaxRetries,
            appliedBySvcB: 1,
            republishedToNats: 0,
        });
    });
});

describe('#648 DLQ-H — DeadLetterProcessorJob replay safety', () => {
    let bus: ReturnType<typeof createFakeStanBus>;
    let clock: ReturnType<typeof useFakeClock>;
    const originalReplayEnabled = process.env.DEAD_LETTER_REPLAY_ENABLED;

    function createServiceA() {
        const client = bus.connect();
        const deadLetters = createDeadLetterStore();
        const createProcessor = () => new DeadLetterProcessorJob(client, deadLetters.connection) as unknown as DeadLetterProcessorInternals;
        return { client, deadLetters, processor: createProcessor(), createProcessor };
    }

    /** A due svc-a record in the shape RetryableListener writes: 5 NATS attempts used, 5 replays left. */
    function seedQueued(deadLetters: ReturnType<typeof createDeadLetterStore>, overrides: Partial<DeadLetterAttrs> = {}) {
        return deadLetters.seed({
            subject: Subjects.StockUpdated,
            eventId: `svc-a-stock-${stockV3.id}-v${stockV3.version}`,
            data: stockV3,
            error: 'ECONNRESET: socket hang up while writing stock copy',
            retryCount: DEFAULT_RETRY_LIMIT,
            maxRetries: 2 * DEFAULT_RETRY_LIMIT,
            status: 'queued',
            listenerKey: SVC_A_KEY,
            queueGroupName: 'svc-a-stock-copy',
            service: 'svc-a',
            nextRetryAt: new Date(Date.now() - 1000),
            timestamp: new Date(),
            ...overrides,
        });
    }

    function snapshot(deadLetters: ReturnType<typeof createDeadLetterStore>) {
        return deadLetters.collection.docs.map(doc => ({ ...doc }));
    }

    beforeEach(() => {
        jest.clearAllMocks();
        (redisWrapper.client as unknown as InMemoryRedis).flushAll();
        process.env.DEAD_LETTER_REPLAY_ENABLED = 'true';
        clock = useFakeClock();
        bus = createFakeStanBus();
    });

    afterEach(() => {
        jest.useRealTimers();
        deadLetterReplayRegistry.clear();
        restoreReplaySwitch(originalReplayEnabled);
    });

    it('DLQ-H4: records of a listener key not started in this process and records without a listener key are not claimed', async () => {
        const svcA = createServiceA();
        const listener = new FailingStockCopyListener(svcA.client, {}, svcA.deadLetters.connection);
        listener.failing = false;
        listener.listen();
        seedQueued(svcA.deadLetters, { listenerKey: `${Subjects.StockUpdated}|svc-a-removed-listener`, queueGroupName: 'svc-a-removed-listener' });
        // Written before DLQ-H: pending, no listener key, replayable by the old processor.
        seedQueued(svcA.deadLetters, { status: 'pending', listenerKey: undefined, queueGroupName: undefined, retryCount: 0 });
        const before = snapshot(svcA.deadLetters);

        await svcA.processor.processPendingEvents();

        expect(listener.attempts).toBe(0);
        expect(svcA.deadLetters.collection.docs).toEqual(before);
    });

    it('DLQ-H5: two processors running at the same time on the same store replay a record once', async () => {
        const svcA = createServiceA();
        const listener = new GatedStockCopyListener(svcA.client, {}, svcA.deadLetters.connection);
        listener.failing = false;
        listener.listen();
        const record = seedQueued(svcA.deadLetters);
        const secondProcessor = svcA.createProcessor();

        const cycles = Promise.all([svcA.processor.processPendingEvents(), secondProcessor.processPendingEvents()]);
        await waitUntil(() => listener.started === 1);
        listener.release();
        await cycles;

        expect({ started: listener.started, applied: listener.applied.length, status: record.status, retryCount: record.retryCount })
            .toEqual({ started: 1, applied: 1, status: 'completed', retryCount: DEFAULT_RETRY_LIMIT });
    });

    it('DLQ-H5: a processor whose claim was taken over after the stuck timeout does not overwrite the record', async () => {
        const svcA = createServiceA();
        const listener = new FailFirstGatedListener(svcA.client, {}, svcA.deadLetters.connection);
        listener.failing = false;
        listener.listen();
        const record = seedQueued(svcA.deadLetters);
        const takeoverProcessor = svcA.createProcessor();

        const stuckCycle = svcA.processor.processPendingEvents();
        await waitUntil(() => listener.started === 1);
        // Pod clocks differ: to the other pod the replay started more than 10 minutes ago, while the replay time limit of
        // the first processor has not passed yet. The 30 s event lock of the first replay expires; the other processor takes the record over.
        record.processingStartedAt = new Date(Date.now() - 11 * 60_000);
        await clock.advance(31_000);
        const takeoverCycle = takeoverProcessor.processPendingEvents();
        await waitUntil(() => listener.started === 2);
        listener.release();
        await Promise.all([stuckCycle, takeoverCycle]);

        // The late failure of the first processor must not add an attempt to the record completed by the second one.
        expect({ status: record.status, retryCount: record.retryCount }).toEqual({ status: 'completed', retryCount: DEFAULT_RETRY_LIMIT });
    });

    it('DLQ-H6: a replay that finds the event locked is retried a minute later without using the attempt budget', async () => {
        const svcA = createServiceA();
        const listener = new FailingStockCopyListener(svcA.client, {}, svcA.deadLetters.connection);
        listener.failing = false;
        listener.listen();
        const record = seedQueued(svcA.deadLetters);
        // A live delivery of the same event holds the lock in another pod.
        await redisWrapper.client.set(`lock:${Subjects.StockUpdated}:${record.eventId}`, 'another-pod', { NX: true, EX: 30 });

        await svcA.processor.processPendingEvents();

        expect({
            attempts: listener.attempts,
            status: record.status,
            retryCount: record.retryCount,
            minutesUntilReplay: ((record.nextRetryAt as Date).getTime() - Date.now()) / 60_000,
            processorId: record.processorId,
        }).toEqual({ attempts: 0, status: 'queued', retryCount: DEFAULT_RETRY_LIMIT, minutesUntilReplay: 1, processorId: undefined });
        expect(EventMetrics.eventDlqReplayTotal.inc).toHaveBeenCalledWith({
            service: 'svc-a', event_type: Subjects.StockUpdated, queue_group: 'svc-a-stock-copy', result: 'busy',
        });
    });

    it.each([
        ['unset', undefined],
        ['"false"', 'false'],
        ['"1"', '1'],
    ])('DLQ-H7: with DEAD_LETTER_REPLAY_ENABLED %s no record is claimed', async (_label, value) => {
        restoreReplaySwitch(value);
        const svcA = createServiceA();
        const listener = new FailingStockCopyListener(svcA.client, {}, svcA.deadLetters.connection);
        listener.failing = false;
        listener.listen();
        seedQueued(svcA.deadLetters);
        const before = snapshot(svcA.deadLetters);

        await svcA.processor.processPendingEvents();

        expect(listener.attempts).toBe(0);
        expect(svcA.deadLetters.collection.docs).toEqual(before);
    });

    it('DLQ-H7: the processor logs at start that replay is disabled unless DEAD_LETTER_REPLAY_ENABLED is "true"', () => {
        restoreReplaySwitch(undefined);
        const disabled = createServiceA().processor as unknown as DeadLetterProcessorJob;
        disabled.start();
        disabled.stop();
        process.env.DEAD_LETTER_REPLAY_ENABLED = 'true';
        const enabled = createServiceA().processor as unknown as DeadLetterProcessorJob;
        enabled.start();
        enabled.stop();

        expect((logger.info as jest.Mock).mock.calls.map(([message]) => message).filter(message => String(message).startsWith('Dead letter processor job started')))
            .toEqual(['Dead letter processor job started (replay disabled)', 'Dead letter processor job started (replay enabled)']);
    });

    it('DLQ-H8: a processor cycle that starts while the previous cycle is still running claims nothing', async () => {
        const svcA = createServiceA();
        const listener = new GatedStockCopyListener(svcA.client, {}, svcA.deadLetters.connection);
        listener.failing = false;
        listener.listen();
        const first = seedQueued(svcA.deadLetters, { nextRetryAt: new Date(Date.now() - 2000) });
        const second = seedQueued(svcA.deadLetters, { eventId: `svc-a-stock-${stockV4.id}-v${stockV4.version}`, data: stockV4 });

        const running = svcA.processor.processPendingEvents();
        await waitUntil(() => listener.started === 1);
        const overlapping = svcA.processor.processPendingEvents();
        await flushTurns(10);
        const whileRunning = { started: listener.started, secondStatus: second.status };
        listener.release();
        await Promise.all([running, overlapping]);

        expect(whileRunning).toEqual({ started: 1, secondStatus: 'queued' });
        expect([first.status, second.status]).toEqual(['completed', 'completed']);
    });

    it('DLQ-H: one processor cycle replays at most 50 records and the rest wait for the next cycle', async () => {
        const svcA = createServiceA();
        const listener = new FailingStockCopyListener(svcA.client, {}, svcA.deadLetters.connection);
        listener.failing = false;
        listener.listen();
        const records = Array.from({ length: 51 }, (_, index) => {
            const data = { ...stockV3, id: `stock-${index}` };
            return seedQueued(svcA.deadLetters, { eventId: `svc-a-stock-${data.id}-v${data.version}`, data });
        });
        const countByStatus = () => records.reduce<Record<string, number>>((counts, record) => {
            counts[String(record.status)] = (counts[String(record.status)] ?? 0) + 1;
            return counts;
        }, {});

        await svcA.processor.processPendingEvents();
        const afterFirstCycle = countByStatus();
        await svcA.processor.processPendingEvents();

        expect({ afterFirstCycle, afterSecondCycle: countByStatus() })
            .toEqual({ afterFirstCycle: { completed: 50, queued: 1 }, afterSecondCycle: { completed: 51 } });
    });

    it('DLQ-H: records of a listener started with deadLetterReplay: false stay queued while other listeners of the service are replayed', async () => {
        const svcA = createServiceA();
        const optedOut = new FailingStockCopyListener(svcA.client, { deadLetterReplay: false }, svcA.deadLetters.connection);
        const mirror = new StockMirrorListener(svcA.client, {}, svcA.deadLetters.connection);
        optedOut.listen();
        mirror.listen();
        const msg = createFakeMessage(stockV3);
        for (let delivery = 0; delivery < DEFAULT_RETRY_LIMIT; delivery++) {
            await optedOut.onMessage(stockV3, msg);
        }
        const [optedOutRecord] = svcA.deadLetters.collection.docs;
        expect({ acked: wasAcked(msg), record: optedOutRecord }).toMatchObject({ acked: true, record: { status: 'queued', listenerKey: SVC_A_KEY } });
        const mirrorRecord = seedQueued(svcA.deadLetters, {
            eventId: `svc-b-stock-${stockV4.id}-v${stockV4.version}`, data: stockV4, listenerKey: SVC_B_KEY, queueGroupName: 'svc-b-stock-mirror',
        });
        optedOut.failing = false;

        for (let cycle = 0; cycle < 3; cycle++) {
            await clock.advance(31 * 60_000);
            await svcA.processor.processPendingEvents();
        }
        await svcA.processor.releaseStuckEvents();

        expect({
            optedOutAttempts: optedOut.attempts,
            optedOutStatus: optedOutRecord.status,
            optedOutRetryCount: optedOutRecord.retryCount,
            mirrorApplied: mirror.applied.map(data => data.version),
            mirrorStatus: mirrorRecord.status,
        }).toEqual({
            optedOutAttempts: DEFAULT_RETRY_LIMIT,
            optedOutStatus: 'queued',
            optedOutRetryCount: DEFAULT_RETRY_LIMIT,
            mirrorApplied: [stockV4.version],
            mirrorStatus: 'completed',
        });
        // The record is expected to wait: it is not reported as a record whose listener is missing.
        expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('no listener registered'));
    });

    it('DLQ-H: the record of a listener started with deadLetterReplay: false is never claimed, so the processor does not touch it at all', async () => {
        const svcA = createServiceA();
        const optedOut = new FailingStockCopyListener(svcA.client, { deadLetterReplay: false }, svcA.deadLetters.connection);
        const mirror = new StockMirrorListener(svcA.client, {}, svcA.deadLetters.connection);
        optedOut.failing = false;
        optedOut.listen();
        mirror.listen();
        // The opted-out record is due first, so a claim that ignored the opt-out would take it before the mirror record.
        const optedOutRecord = seedQueued(svcA.deadLetters, { nextRetryAt: new Date(Date.now() - 2000) });
        const mirrorRecord = seedQueued(svcA.deadLetters, {
            eventId: `svc-b-stock-${stockV4.id}-v${stockV4.version}`, data: stockV4, listenerKey: SVC_B_KEY, queueGroupName: 'svc-b-stock-mirror',
        });
        const optedOutBefore = { ...optedOutRecord };

        for (let cycle = 0; cycle < 3; cycle++) {
            await clock.advance(31 * 60_000);
            await svcA.processor.processPendingEvents();
        }

        expect({ ...optedOutRecord }).toEqual(optedOutBefore);
        expect({ optedOutAttempts: optedOut.attempts, mirrorApplied: mirror.applied.map(data => data.version), mirrorStatus: mirrorRecord.status })
            .toEqual({ optedOutAttempts: 0, mirrorApplied: [stockV4.version], mirrorStatus: 'completed' });
        expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('No replay target registered'));
    });

    it('DLQ-H: a replay stuck for more than 10 minutes is released and replayed again; a stuck record of the old processor goes back to pending', async () => {
        const svcA = createServiceA();
        const listener = new FailingStockCopyListener(svcA.client, {}, svcA.deadLetters.connection);
        listener.failing = false;
        listener.listen();
        const stuckSince = new Date(Date.now() - 11 * 60_000);
        const record = seedQueued(svcA.deadLetters, { status: 'replaying', processorId: 'crashed-pod', processingStartedAt: stuckSince });
        const legacy = seedQueued(svcA.deadLetters, {
            status: 'processing', listenerKey: undefined, queueGroupName: undefined, processorId: 'old-pod', processingStartedAt: stuckSince,
        });

        await svcA.processor.releaseStuckEvents();
        const released = { record: { ...record }, legacy: { ...legacy } };
        await svcA.processor.processPendingEvents();

        expect(released.record).toMatchObject({ status: 'queued' });
        expect(released.record).not.toHaveProperty('processorId');
        expect(released.legacy).toMatchObject({ status: 'pending' });
        expect({ attempts: listener.attempts, record: record.status, legacy: legacy.status })
            .toEqual({ attempts: 1, record: 'completed', legacy: 'pending' });
        expect(logger.info).toHaveBeenCalledWith('Released 2 stuck dead letter events');
    });

    it('DLQ-H: a replay that started less than 10 minutes ago is not released, so another pod cannot replay it at the same time', async () => {
        const svcA = createServiceA();
        new FailingStockCopyListener(svcA.client, {}, svcA.deadLetters.connection).listen();
        const running = seedQueued(svcA.deadLetters, {
            status: 'replaying', processorId: 'pod-1', processingStartedAt: new Date(Date.now() - 9 * 60_000),
        });
        const stuck = seedQueued(svcA.deadLetters, {
            eventId: `svc-a-stock-${stockV4.id}-v${stockV4.version}`, data: stockV4,
            status: 'replaying', processorId: 'crashed-pod', processingStartedAt: new Date(Date.now() - 11 * 60_000),
        });
        const runningBefore = { ...running };

        await svcA.processor.releaseStuckEvents();

        expect({ ...running }).toEqual(runningBefore);
        expect({ status: stuck.status, processorId: stuck.processorId }).toEqual({ status: 'queued', processorId: undefined });
        expect(logger.info).toHaveBeenCalledWith('Released 1 stuck dead letter events');
    });

    it('DLQ-H: dead-letter records of another environment in the same database are neither claimed nor released', async () => {
        // A process of one environment can share the database of another (e.g. a local service on the production database).
        const currentEnvironment = process.env.NODE_ENV || 'production';
        const otherEnvironment = currentEnvironment === 'production' ? 'development' : 'production';
        const svcA = createServiceA();
        const listener = new FailingStockCopyListener(svcA.client, {}, svcA.deadLetters.connection);
        listener.failing = false;
        listener.listen();
        const otherQueued = seedQueued(svcA.deadLetters, { environment: otherEnvironment, nextRetryAt: new Date(Date.now() - 2000) });
        const otherStuck = seedQueued(svcA.deadLetters, {
            environment: otherEnvironment, eventId: `svc-a-stock-${stockV4.id}-v${stockV4.version}`, data: stockV4,
            status: 'replaying', processorId: 'other-environment-pod', processingStartedAt: new Date(Date.now() - 11 * 60_000),
        });
        const ownData = { ...stockV3, id: 'stock-2' };
        const own = seedQueued(svcA.deadLetters, { eventId: `svc-a-stock-${ownData.id}-v${ownData.version}`, data: ownData });
        const otherBefore = [{ ...otherQueued }, { ...otherStuck }];

        await svcA.processor.releaseStuckEvents();
        await svcA.processor.processPendingEvents();

        expect([{ ...otherQueued }, { ...otherStuck }]).toEqual(otherBefore);
        expect({ applied: listener.applied.map(data => data.id), ownStatus: own.status }).toEqual({ applied: [ownData.id], ownStatus: 'completed' });
    });

    it('DLQ-H: a replay that does not finish within 10 minutes is released as busy with a warning and the processor goes on with the next record', async () => {
        const svcA = createServiceA();
        const listener = new GatedStockCopyListener(svcA.client, {}, svcA.deadLetters.connection);
        listener.failing = false;
        listener.listen();
        const hanging = seedQueued(svcA.deadLetters, { nextRetryAt: new Date(Date.now() - 2000) });
        const next = seedQueued(svcA.deadLetters, { eventId: `svc-a-stock-${stockV4.id}-v${stockV4.version}`, data: stockV4 });

        const cycle = svcA.processor.processPendingEvents();
        await waitUntil(() => listener.started === 1);
        await clock.advance(9 * 60_000);
        const beforeLimit = { status: hanging.status, started: listener.started };
        // The handler never returns, e.g. an external call without a timeout.
        await clock.advance(60_000);
        await waitUntil(() => listener.started === 2);

        expect(beforeLimit).toEqual({ status: 'replaying', started: 1 });
        expect({
            status: hanging.status,
            retryCount: hanging.retryCount,
            minutesUntilReplay: ((hanging.nextRetryAt as Date).getTime() - Date.now()) / 60_000,
            processorId: hanging.processorId,
            nextStatus: next.status,
        }).toEqual({ status: 'queued', retryCount: DEFAULT_RETRY_LIMIT, minutesUntilReplay: 1, processorId: undefined, nextStatus: 'replaying' });
        expect(logger.warn).toHaveBeenCalledWith(
            `Dead letter replay of ${hanging.id} did not finish within 10 minutes, releasing the record without using the attempt budget: ${SVC_A_KEY}`
        );

        // Both handlers return: the late result of the released replay is not written, the next record completes.
        listener.release();
        await cycle;

        const labels = { service: 'svc-a', event_type: Subjects.StockUpdated, queue_group: 'svc-a-stock-copy' };
        expect({ status: hanging.status, retryCount: hanging.retryCount, nextStatus: next.status })
            .toEqual({ status: 'queued', retryCount: DEFAULT_RETRY_LIMIT, nextStatus: 'completed' });
        expect((EventMetrics.eventDlqReplayTotal.inc as jest.Mock).mock.calls).toEqual([[{ ...labels, result: 'busy' }], [{ ...labels, result: 'processed' }]]);
        expect(jest.getTimerCount()).toBe(0);
    });

    it('DLQ-H: queued records whose listener is not started in this process are counted in a warning', async () => {
        const svcA = createServiceA();
        const listener = new FailingStockCopyListener(svcA.client, {}, svcA.deadLetters.connection);
        listener.listen();
        seedQueued(svcA.deadLetters);
        const removedKey = { listenerKey: `${Subjects.StockUpdated}|svc-a-removed-listener`, queueGroupName: 'svc-a-removed-listener' };
        seedQueued(svcA.deadLetters, removedKey);
        seedQueued(svcA.deadLetters, { ...removedKey, status: 'failed' });

        await svcA.processor.releaseStuckEvents();

        expect(logger.warn).toHaveBeenCalledWith('1 queued dead letter events have no listener registered in this process and will not be replayed');
    });

    it('DLQ-H: a claimed record whose listener is no longer registered is put back without using the attempt budget', async () => {
        const svcA = createServiceA();
        const listener = new GatedStockCopyListener(svcA.client, {}, svcA.deadLetters.connection);
        listener.failing = false;
        listener.listen();
        seedQueued(svcA.deadLetters, { nextRetryAt: new Date(Date.now() - 2000) });
        const second = seedQueued(svcA.deadLetters, { eventId: `svc-a-stock-${stockV4.id}-v${stockV4.version}`, data: stockV4 });

        const running = svcA.processor.processPendingEvents();
        await waitUntil(() => listener.started === 1);
        deadLetterReplayRegistry.clear();
        listener.release();
        await running;

        expect({
            status: second.status,
            retryCount: second.retryCount,
            minutesUntilReplay: ((second.nextRetryAt as Date).getTime() - Date.now()) / 60_000,
            started: listener.started,
        }).toEqual({ status: 'queued', retryCount: DEFAULT_RETRY_LIMIT, minutesUntilReplay: 1, started: 1 });
    });

    it('DLQ-H: every replay is counted by result on the queue group of the record', async () => {
        const svcA = createServiceA();
        const listener = new FailingStockCopyListener(svcA.client, {}, svcA.deadLetters.connection);
        listener.listen();
        const record = seedQueued(svcA.deadLetters);

        await svcA.processor.processPendingEvents();
        listener.failing = false;
        await clock.advance(31 * 60_000);
        await svcA.processor.processPendingEvents();

        const labels = { service: 'svc-a', event_type: Subjects.StockUpdated, queue_group: 'svc-a-stock-copy' };
        expect((EventMetrics.eventDlqReplayTotal.inc as jest.Mock).mock.calls)
            .toEqual([[{ ...labels, result: 'failed' }], [{ ...labels, result: 'processed' }]]);
        expect(record).toMatchObject({ status: 'completed', retryCount: DEFAULT_RETRY_LIMIT + 1 });
    });
});

describe('#648 DLQ-H — RetryableListener.replayDeadLetter', () => {
    const retryKey = `event:retry:${Subjects.StockUpdated}:svc-a-stock-${stockV3.id}-v${stockV3.version}`;
    const lockKey = `lock:${Subjects.StockUpdated}:svc-a-stock-${stockV3.id}-v${stockV3.version}`;
    let bus: ReturnType<typeof createFakeStanBus>;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
        (redisWrapper.client as unknown as InMemoryRedis).flushAll();
        bus = createFakeStanBus();
    });

    afterEach(() => {
        deadLetterReplayRegistry.clear();
    });

    /** A listener whose event already failed twice on NATS, so the retry counter is 2. */
    async function listenerWithTwoFailures(options: { enableLock?: boolean } = {}) {
        const deadLetters = createDeadLetterStore();
        const listener = new FailingStockCopyListener(bus.connect(), options, deadLetters.connection);
        const msg = createFakeMessage(stockV3);
        await listener.onMessage(stockV3, msg);
        await listener.onMessage(stockV3, msg);
        expect(await redisWrapper.client.get(retryKey)).toBe('2');
        return { listener, deadLetters, msg };
    }

    it('processed: runs processEvent once under the event lock, releases the lock and resets the retry counter', async () => {
        const { listener, deadLetters, msg } = await listenerWithTwoFailures();
        listener.failing = false;

        const result = await listener.replayDeadLetter(stockV3);

        expect({
            result,
            applied: listener.applied.length,
            retryCounter: await redisWrapper.client.get(retryKey),
            lock: await redisWrapper.client.get(lockKey),
            acked: wasAcked(msg),
            deadLetterRecords: deadLetters.collection.docs.length,
            published: bus.publish.mock.calls.length,
        }).toEqual({ result: 'processed', applied: 1, retryCounter: null, lock: null, acked: false, deadLetterRecords: 0, published: 0 });
    });

    it('failed: returns failed and leaves the retry counter, the message and the dead-letter store untouched', async () => {
        const { listener, deadLetters, msg } = await listenerWithTwoFailures();

        const result = await listener.replayDeadLetter(stockV3);

        expect({
            result,
            attempts: listener.attempts,
            retryCounter: await redisWrapper.client.get(retryKey),
            lock: await redisWrapper.client.get(lockKey),
            acked: wasAcked(msg),
            deadLetterRecords: deadLetters.collection.docs.length,
        }).toEqual({ result: 'failed', attempts: 3, retryCounter: '2', lock: null, acked: false, deadLetterRecords: 0 });
        expect(logger.error).toHaveBeenCalledWith(`Dead letter replay failed: ${Subjects.StockUpdated}:svc-a-stock-stock-1-v3:`, expect.any(Error));
    });

    it('busy: returns busy without running processEvent while another delivery holds the event lock', async () => {
        const { listener } = await listenerWithTwoFailures();
        listener.failing = false;
        await redisWrapper.client.set(lockKey, 'another-pod', { NX: true, EX: 30 });

        const result = await listener.replayDeadLetter(stockV3);

        expect({ result, attempts: listener.attempts, lock: await redisWrapper.client.get(lockKey), retryCounter: await redisWrapper.client.get(retryKey) })
            .toEqual({ result: 'busy', attempts: 2, lock: 'another-pod', retryCounter: '2' });
    });

    it('busy: returns busy when the lock cannot be taken because Redis fails', async () => {
        const { listener } = await listenerWithTwoFailures();
        listener.failing = false;
        jest.spyOn(redisWrapper.client, 'set').mockRejectedValueOnce(new Error('Redis connection lost'));

        const result = await listener.replayDeadLetter(stockV3);

        expect({ result, attempts: listener.attempts }).toEqual({ result: 'busy', attempts: 2 });
    });

    it('processed: a duplicate key error counts as processed, like the live delivery path', async () => {
        const { listener } = await listenerWithTwoFailures();
        jest.spyOn(listener as unknown as { processEvent(data: StockCopyEvent['data']): Promise<void> }, 'processEvent')
            .mockRejectedValueOnce(Object.assign(new Error('E11000 duplicate key error collection: stocks index: uniqueCode_1'), { code: 11000 }));

        expect(await listener.replayDeadLetter(stockV3)).toBe('processed');
    });

    it('without the event lock (enableLock: false) the event is processed directly and no lock is taken', async () => {
        const { listener } = await listenerWithTwoFailures({ enableLock: false });
        listener.failing = false;
        const setSpy = jest.spyOn(redisWrapper.client, 'set');

        const result = await listener.replayDeadLetter(stockV3);

        expect({ result, applied: listener.applied.length, lockCalls: setSpy.mock.calls.filter(([key]) => String(key).startsWith('lock:')).length })
            .toEqual({ result: 'processed', applied: 1, lockCalls: 0 });
    });

    it('processed: the replay is still processed when the retry counter cannot be reset', async () => {
        const { listener } = await listenerWithTwoFailures();
        listener.failing = false;
        const redis = redisWrapper.client as unknown as InMemoryRedis;
        const deleteKey = redis.del.bind(redis);
        // Only the retry counter fails; the lock release (compare-and-delete) keeps working.
        jest.spyOn(redis, 'del').mockImplementation(async (key: string) => {
            if (key === retryKey) throw new Error('Redis connection lost');
            return deleteKey(key);
        });

        const result = await listener.replayDeadLetter(stockV3);

        expect({ result, applied: listener.applied.length }).toEqual({ result: 'processed', applied: 1 });
        expect(logger.warn).toHaveBeenCalledWith(
            `Failed to reset retry count after dead letter replay: ${Subjects.StockUpdated}:svc-a-stock-stock-1-v3`, expect.any(Error)
        );
    });

    it('getDeadLetterReplayDelay: 1, 2, 4, 8, 16 minutes after the NATS attempts, capped at 30 minutes', () => {
        const listener = new FailingStockCopyListener(bus.connect(), { maxRetries: 3 }, createDeadLetterStore().connection);

        expect([0, 3, 4, 5, 6, 7, 8, 9, 20].map(retryCount => listener.getDeadLetterReplayDelay(retryCount) / 60_000))
            .toEqual([1, 1, 2, 4, 8, 16, 30, 30, 30]);
    });

    it('listen() registers the listener under "<subject>|<queueGroupName>" with the deadLetterReplay option', () => {
        const replaying = new FailingStockCopyListener(bus.connect(), {}, createDeadLetterStore().connection);
        const optedOut = new StockMirrorListener(bus.connect(), { deadLetterReplay: false }, createDeadLetterStore().connection);

        replaying.listen();
        optedOut.listen();

        expect({
            registered: deadLetterReplayRegistry.registeredKeys(),
            replayable: deadLetterReplayRegistry.replayableKeys(),
            target: deadLetterReplayRegistry.get(SVC_A_KEY) === replaying,
            subscriptions: bus.queueGroups(Subjects.StockUpdated),
        }).toEqual({
            registered: [SVC_A_KEY, SVC_B_KEY],
            replayable: [SVC_A_KEY],
            target: true,
            subscriptions: ['svc-a-stock-copy', 'svc-b-stock-mirror'],
        });
    });
});

describe('#648 DLQ-H — EventMetrics dead-letter counters', () => {
    it('registers event_dlq_replay_total and event_dlq_write_error_total with their labels and keeps them after reset()', async () => {
        const { EventMetrics: RealEventMetrics } = jest.requireActual('../metrics/EventMetrics') as typeof import('../metrics/EventMetrics');
        RealEventMetrics.reset();
        RealEventMetrics.eventDlqReplayTotal.inc({ service: 'svc-a', event_type: Subjects.StockUpdated, queue_group: 'svc-a-stock-copy', result: 'busy' });
        RealEventMetrics.eventDlqWriteErrorTotal.inc({ service: 'svc-a', event_type: Subjects.StockUpdated, reason: 'invalid' });

        const exported = await RealEventMetrics.getRegistry().metrics();
        RealEventMetrics.reset();
        const afterReset = await RealEventMetrics.getRegistry().metrics();

        expect(exported).toContain(`event_dlq_replay_total{service="svc-a",event_type="${Subjects.StockUpdated}",queue_group="svc-a-stock-copy",result="busy"} 1`);
        expect(exported).toContain(`event_dlq_write_error_total{service="svc-a",event_type="${Subjects.StockUpdated}",reason="invalid"} 1`);
        expect(afterReset).toContain('# TYPE event_dlq_replay_total counter');
        expect(afterReset).toContain('# TYPE event_dlq_write_error_total counter');
        expect(afterReset).not.toContain('result="busy"} 1');
    });
});
