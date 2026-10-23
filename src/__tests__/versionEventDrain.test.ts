/**
 * UC-984 — EntityVersionUpdated bulk publishing capacity.
 *
 * Before UC-984 processVersionEventsAsBulk published ONE message of at most 100 records per 2-minute
 * tick (ceiling 3,000/h) while the morning peak produced 4,200–4,700/h, so the version queue kept
 * growing. Each tick now publishes 100-record messages until the queue is empty or the per-tick batch
 * cap is reached. Tests marked "UC-984:" fail on the old single-batch code.
 * Only Mongo and NATS are replaced by the in-memory fakes of the #648 harness.
 */
import { EventPublisherJob } from '../jobs/eventPublisher.job';
import { Subjects } from '../common';
import { createFakeStan, createOutboxStore, useFakeClock } from '../test/fakes/eventDeliveryHarness';

jest.mock('../services/logger.service', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    }
}));

// Covers the in-process retries of EntityVersionBulkUpdatedPublisher (0.5+1+1.5+2 s) for every batch of a tick.
const TICK_WINDOW_MS = 60_000;
const ENV_KEYS = ['VERSION_EVENT_BATCH_SIZE', 'VERSION_EVENT_MAX_BATCHES_PER_TICK', 'VERSION_EVENT_INTERVAL_MS'];

type JobInternals = {
    processVersionEventsAsBulk(): Promise<void>;
};

function versionPayload(entityId: string) {
    return { entityType: 'ProductStock', entityId, service: 'inventory', version: 2, previousVersion: 1, timestamp: new Date(), userId: 'user-1' };
}

describe('UC-984 — EventPublisherJob drains the version event queue every tick', () => {
    let nats: ReturnType<typeof createFakeStan>;
    let outbox: ReturnType<typeof createOutboxStore>;
    let clock: ReturnType<typeof useFakeClock>;

    const newJob = () => new EventPublisherJob(nats.client, outbox.connection) as unknown as JobInternals;
    const seedVersions = (count: number, prefix = 'ps') =>
        Array.from({ length: count }, (_, i) => outbox.seed(Subjects.EntityVersionUpdated, versionPayload(`${prefix}-${i}`)));
    /** Bulk messages published so far, decoded. */
    const bulkMessages = () => nats.publish.mock.calls
        .filter(([subject]) => subject === Subjects.EntityVersionBulkUpdated)
        .map(([, data]) => JSON.parse(data) as { updates: Array<{ entityId: string }>; batchSize: number });
    const countByStatus = (status: string) => outbox.collection.docs.filter(d => d.status === status).length;

    beforeEach(() => {
        jest.clearAllMocks();
        ENV_KEYS.forEach(key => delete process.env[key]);
        clock = useFakeClock();
        nats = createFakeStan();
        outbox = createOutboxStore();
    });

    afterEach(() => {
        jest.useRealTimers();
        ENV_KEYS.forEach(key => delete process.env[key]);
    });

    it('UC-984: one tick publishes the whole queue in messages of at most 100 records', async () => {
        seedVersions(1250);

        await clock.run(newJob().processVersionEventsAsBulk(), TICK_WINDOW_MS);

        const messages = bulkMessages();
        expect(messages.map(m => m.batchSize)).toEqual([...Array(12).fill(100), 50]);
        messages.forEach(m => expect(m.updates).toHaveLength(m.batchSize));
        expect(countByStatus('published')).toBe(1250);
        expect(countByStatus('pending')).toBe(0);
    });

    it('UC-984: the morning peak (4,700/h) no longer accumulates — 2 minutes of production is drained in one tick', async () => {
        const perTick = Math.ceil(4700 / 30); // 30 ticks per hour
        const ticks = 8; // the old code was already 456 records behind after these 16 minutes
        const job = newJob();

        for (let tick = 0; tick < ticks; tick++) {
            seedVersions(perTick, `t${tick}`);
            await clock.run(job.processVersionEventsAsBulk(), TICK_WINDOW_MS);
            expect(countByStatus('pending')).toBe(0);
        }
        expect(countByStatus('published')).toBe(perTick * ticks);
    });

    it('UC-984: a tick stops at the batch cap (default 20 × 100) and the next tick continues in creation order', async () => {
        const records = seedVersions(2500);
        const job = newJob();

        await clock.run(job.processVersionEventsAsBulk(), TICK_WINDOW_MS);
        expect(bulkMessages()).toHaveLength(20);
        expect(countByStatus('published')).toBe(2000);
        expect(records.slice(0, 2000).every(r => r.status === 'published')).toBe(true);
        expect(records.slice(2000).every(r => r.status === 'pending')).toBe(true);

        await clock.run(job.processVersionEventsAsBulk(), TICK_WINDOW_MS);
        expect(bulkMessages()).toHaveLength(25);
        expect(countByStatus('published')).toBe(2500);
    });

    it('a smaller batch size and batch cap can be set by env', async () => {
        process.env.VERSION_EVENT_BATCH_SIZE = '30';
        process.env.VERSION_EVENT_MAX_BATCHES_PER_TICK = '3';
        seedVersions(200);

        await clock.run(newJob().processVersionEventsAsBulk(), TICK_WINDOW_MS);

        expect(bulkMessages().map(m => m.batchSize)).toEqual([30, 30, 30]);
        expect(countByStatus('pending')).toBe(110);
    });

    it('the batch size cannot exceed 100 records per message (NATS message size)', async () => {
        process.env.VERSION_EVENT_BATCH_SIZE = '500';
        seedVersions(250);

        await clock.run(newJob().processVersionEventsAsBulk(), TICK_WINDOW_MS);

        expect(bulkMessages().map(m => m.batchSize)).toEqual([100, 100, 50]);
    });

    it.each(['', 'abc', '0', '-5', '2.5'])('invalid batch size %p falls back to 100', async (value) => {
        process.env.VERSION_EVENT_BATCH_SIZE = value;
        seedVersions(250);

        await clock.run(newJob().processVersionEventsAsBulk(), TICK_WINDOW_MS);

        expect(bulkMessages().map(m => m.batchSize)).toEqual([100, 100, 50]);
    });

    it.each(['', 'abc', '0', '-5', '2.5'])('invalid batch cap %p falls back to 20 batches', async (value) => {
        process.env.VERSION_EVENT_BATCH_SIZE = '10';
        process.env.VERSION_EVENT_MAX_BATCHES_PER_TICK = value;
        seedVersions(250);

        await clock.run(newJob().processVersionEventsAsBulk(), TICK_WINDOW_MS);

        expect(bulkMessages()).toHaveLength(20);
        expect(countByStatus('pending')).toBe(50);
    });

    it('a failed publish ends the tick: only the failed batch is marked, the rest stays pending', async () => {
        seedVersions(500);
        nats.setPublishFails(true);

        await clock.run(newJob().processVersionEventsAsBulk(), TICK_WINDOW_MS);

        expect(countByStatus('failed')).toBe(100);
        expect(countByStatus('pending')).toBe(400);
        expect(countByStatus('published')).toBe(0);
    });

    it('a tick that is still running is not started a second time on the same pod (the batch cap holds per pod)', async () => {
        process.env.VERSION_EVENT_MAX_BATCHES_PER_TICK = '2';
        seedVersions(500);
        const job = newJob();

        const first = job.processVersionEventsAsBulk();
        const second = job.processVersionEventsAsBulk();
        await clock.run(Promise.all([first, second]), TICK_WINDOW_MS);

        expect(bulkMessages().map(m => m.batchSize)).toEqual([100, 100]);
        expect(countByStatus('pending')).toBe(300);

        // The guard is released when the tick ends: the next tick runs.
        await clock.run(job.processVersionEventsAsBulk(), TICK_WINDOW_MS);
        expect(countByStatus('pending')).toBe(100);
    });

    it('records claimed by another pod between read and claim are not published twice', async () => {
        const records = seedVersions(100);
        const realUpdateMany = outbox.collection.updateMany.bind(outbox.collection);
        const spy = jest.spyOn(outbox.collection, 'updateMany').mockImplementationOnce(async (filter, update) => {
            // Another pod claims the first 10 records right before this pod's claim.
            records.slice(0, 10).forEach(r => {
                r.status = 'processing';
                r.processingStartedAt = new Date(0);
            });
            return realUpdateMany(filter, update);
        });

        await clock.run(newJob().processVersionEventsAsBulk(), TICK_WINDOW_MS);
        spy.mockRestore();

        const published = bulkMessages().flatMap(m => m.updates.map(u => u.entityId));
        expect(published).toHaveLength(90);
        expect(published).not.toContain('ps-0');
        expect(records.slice(0, 10).every(r => r.status === 'processing')).toBe(true);
        expect(records.slice(10).every(r => r.status === 'published')).toBe(true);
    });

    it('old (single batch) and new pods on the same queue publish every record exactly once', async () => {
        seedVersions(1000);
        process.env.VERSION_EVENT_MAX_BATCHES_PER_TICK = '1'; // pre-UC-984 behaviour
        const oldPod = newJob();
        delete process.env.VERSION_EVENT_MAX_BATCHES_PER_TICK;
        const newPod = newJob();

        await clock.run(Promise.all([oldPod.processVersionEventsAsBulk(), newPod.processVersionEventsAsBulk()]), TICK_WINDOW_MS);

        const published = bulkMessages().flatMap(m => m.updates.map(u => u.entityId));
        expect(published).toHaveLength(1000);
        expect(new Set(published).size).toBe(1000);
        expect(bulkMessages().every(m => m.batchSize <= 100)).toBe(true);
        expect(countByStatus('published')).toBe(1000);
    });
});
