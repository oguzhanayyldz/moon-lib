/**
 * UC-984 — zero loss for EntityVersionUpdated outbox records (real Mongo, mongodb-memory-server).
 *
 * - monitorFailedEvents returned a processing record to pending only when processingStartedAt was an old Date;
 *   a record without one stayed processing forever. Such records are now recovered by updatedOn / creationDate,
 *   limited to the own environment and the last 24 hours (older backlog is the recovery script's job).
 * - A claim only marks its own records published: a record recovered and re-claimed meanwhile is left alone.
 * - Outbox gauges (version queue, oldest age, unrecoverable records) and the publish / write error counters.
 * Tests marked "UC-984:" fail on the code before UC-984.
 */
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { EventPublisherJob } from '../jobs/eventPublisher.job';
import { createOutboxModel } from '../models/outbox.schema';
import { createBaseSchema } from '../models/base/base.schema';
import { EventMetrics } from '../metrics/EventMetrics';
import { Subjects } from '../common/events/subjects';
import { EntityType, ServiceName } from '../common/types/entity.types';
import { createFakeStan } from '../test/fakes/eventDeliveryHarness';

jest.mock('../services/logger.service', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

jest.setTimeout(120000);

const MIN = 60_000;
const ENV = 'test';

type JobInternals = {
    monitorFailedEvents(): Promise<void>;
    processVersionEventsAsBulk(): Promise<void>;
};

describe('UC-984 — outbox recovery, claim ownership and outbox metrics (real Mongo)', () => {
    let mms: MongoMemoryServer;
    let conn: mongoose.Connection;
    let Outbox: ReturnType<typeof createOutboxModel>;
    let nats: ReturnType<typeof createFakeStan>;
    let previousEnv: string | undefined;
    let previousService: string | undefined;

    const newJob = () => new EventPublisherJob(nats.client, conn) as unknown as JobInternals;
    const ago = (ms: number) => new Date(Date.now() - ms);

    /** Raw insert: no schema hooks, so missing / non-Date fields stay exactly as given. */
    const insert = async (fields: Record<string, unknown>) => {
        const doc = {
            _id: new mongoose.Types.ObjectId(),
            uniqueCode: new mongoose.Types.ObjectId().toString(),
            uuid: new mongoose.Types.ObjectId().toString(),
            eventType: Subjects.EntityVersionUpdated,
            payload: { entityType: 'ProductStock', entityId: new mongoose.Types.ObjectId().toString(), service: 'inventory', version: 2, previousVersion: 1, userId: 'user-1' },
            status: 'pending',
            retryCount: 0,
            environment: ENV,
            priority: 2,
            creationDate: ago(MIN),
            ...fields
        };
        await Outbox.collection.insertOne(doc);
        return doc._id;
    };
    const statusOf = async (id: mongoose.Types.ObjectId) => (await Outbox.collection.findOne({ _id: id }))?.status;

    const metricValues = async (name: string) => {
        const metric = (await EventMetrics.getRegistry().getMetricsAsJSON()).find(m => m.name === name);
        return (metric?.values ?? []) as Array<{ value: number; labels: Record<string, string> }>;
    };

    beforeAll(async () => {
        mms = await MongoMemoryServer.create({ binary: { version: '6.0.4' } });
        conn = await mongoose.createConnection(mms.getUri()).asPromise();
        Outbox = createOutboxModel(conn);
        await Outbox.createCollection();
    });

    afterAll(async () => {
        await conn.close();
        await mms.stop();
    });

    beforeEach(async () => {
        previousEnv = process.env.NODE_ENV;
        previousService = process.env.SERVICE_NAME;
        process.env.NODE_ENV = ENV;
        process.env.SERVICE_NAME = 'inventory';
        EventMetrics.reset();
        nats = createFakeStan();
        await Outbox.deleteMany({});
    });

    afterEach(() => {
        process.env.NODE_ENV = previousEnv;
        if (previousService === undefined) delete process.env.SERVICE_NAME;
        else process.env.SERVICE_NAME = previousService;
    });

    describe('monitorFailedEvents — stuck processing records', () => {
        it('control: processingStartedAt older than 5 minutes returns to pending, a fresh claim stays', async () => {
            const old = await insert({ status: 'processing', processingStartedAt: ago(6 * MIN) });
            const fresh = await insert({ status: 'processing', processingStartedAt: ago(1 * MIN) });

            await newJob().monitorFailedEvents();

            expect(await statusOf(old)).toBe('pending');
            expect(await statusOf(fresh)).toBe('processing');
            expect((await Outbox.collection.findOne({ _id: old }))?.processingStartedAt).toBeUndefined();
        });

        it('UC-984: a record without processingStartedAt is recovered by updatedOn', async () => {
            const id = await insert({ status: 'processing', updatedOn: ago(10 * MIN), creationDate: ago(20 * MIN) });

            await newJob().monitorFailedEvents();

            expect(await statusOf(id)).toBe('pending');
        });

        it('UC-984: a non-Date processingStartedAt (string / null) is recovered by updatedOn', async () => {
            const asString = await insert({ status: 'processing', processingStartedAt: ago(10 * MIN).toISOString(), updatedOn: ago(10 * MIN) });
            const asNull = await insert({ status: 'processing', processingStartedAt: null, updatedOn: ago(10 * MIN) });

            await newJob().monitorFailedEvents();

            expect(await statusOf(asString)).toBe('pending');
            expect(await statusOf(asNull)).toBe('pending');
        });

        it('UC-984: without updatedOn the creationDate decides', async () => {
            const old = await insert({ status: 'processing', creationDate: ago(10 * MIN) });
            const recent = await insert({ status: 'processing', creationDate: ago(2 * MIN) });

            await newJob().monitorFailedEvents();

            expect(await statusOf(old)).toBe('pending');
            expect(await statusOf(recent)).toBe('processing');
        });

        it('fallback is not applied to a recently touched record (updatedOn < 5 minutes) even if created long ago', async () => {
            const id = await insert({ status: 'processing', updatedOn: ago(2 * MIN), creationDate: ago(20 * MIN) });

            await newJob().monitorFailedEvents();

            expect(await statusOf(id)).toBe('processing');
        });

        it('fallback leaves records older than 24 hours (backlog → recovery script) and other environments alone', async () => {
            const backlog = await insert({ status: 'processing', updatedOn: ago(80 * 24 * 60 * MIN), creationDate: ago(80 * 24 * 60 * MIN) });
            const otherEnv = await insert({ status: 'processing', environment: 'development', updatedOn: ago(10 * MIN) });

            await newJob().monitorFailedEvents();

            expect(await statusOf(backlog)).toBe('processing');
            expect(await statusOf(otherEnv)).toBe('processing');
        });

        it('UC-1070: a record of another environment with an old processingStartedAt stays processing', async () => {
            // Shared Mongo: a production pod must not hand a development claim back (and vice versa)
            const otherEnv = await insert({ status: 'processing', environment: 'development', processingStartedAt: ago(10 * MIN) });
            const own = await insert({ status: 'processing', processingStartedAt: ago(10 * MIN) });

            await newJob().monitorFailedEvents();

            expect(await statusOf(otherEnv)).toBe('processing');
            expect((await Outbox.collection.findOne({ _id: otherEnv }))?.processingStartedAt).toBeInstanceOf(Date);
            expect(await statusOf(own)).toBe('pending');
        });

        it('UC-1070: permanently failed records of another environment do not raise the ALERT', async () => {
            const { logger } = jest.requireMock('../services/logger.service') as { logger: { error: jest.Mock } };
            const alerts = () => logger.error.mock.calls.filter(([message]) => String(message).startsWith('ALERT:'));
            logger.error.mockClear();
            await Promise.all(Array.from({ length: 6 }, () => insert({ status: 'failed', environment: 'development', retryCount: 5 })));

            await newJob().monitorFailedEvents();
            expect(alerts()).toHaveLength(0);

            // Control: the same records in the own environment do raise it
            await Promise.all(Array.from({ length: 6 }, () => insert({ status: 'failed', retryCount: 5 })));
            await newJob().monitorFailedEvents();
            expect(alerts()).toEqual([[`ALERT: 6 events have failed permanently!`]]);
        });

        it('UC-984: a recovered record is published by the next version tick (no loss end to end)', async () => {
            const id = await insert({ status: 'processing', updatedOn: ago(10 * MIN) });
            const job = newJob();

            await job.monitorFailedEvents();
            await job.processVersionEventsAsBulk();

            expect(await statusOf(id)).toBe('published');
            const bulk = nats.publish.mock.calls.filter(([subject]) => subject === Subjects.EntityVersionBulkUpdated);
            expect(bulk).toHaveLength(1);
        });
    });

    describe('claim ownership', () => {
        it('UC-984: a record recovered and re-claimed during the publish is not marked published by the old claim', async () => {
            const ids = await Promise.all([insert({}), insert({}), insert({})]);
            const reclaimedAt = new Date(Date.now() + 1000);
            nats.publish.mockImplementationOnce((_subject: string, _data: string, callback: (err?: Error) => void) => {
                // Another pod recovered ids[1] and claimed it again while this message was in flight
                Outbox.collection.updateOne({ _id: ids[1] }, { $set: { status: 'processing', processingStartedAt: reclaimedAt } })
                    .then(() => callback(undefined));
                return 'guid';
            });

            await newJob().processVersionEventsAsBulk();

            expect(await statusOf(ids[0])).toBe('published');
            expect(await statusOf(ids[2])).toBe('published');
            const reclaimed = await Outbox.collection.findOne({ _id: ids[1] });
            expect(reclaimed?.status).toBe('processing');
            expect(reclaimed?.processingStartedAt).toEqual(reclaimedAt);
        });

        it('publish counter counts the records of every successful bulk message', async () => {
            await Promise.all(Array.from({ length: 150 }, () => insert({})));

            await newJob().processVersionEventsAsBulk();

            expect(await metricValues('outbox_version_events_published_total'))
                .toEqual([expect.objectContaining({ value: 150, labels: { service: 'inventory' } })]);
        });

        it('a failed bulk message does not increase the publish counter', async () => {
            await insert({});
            nats.setPublishFails(true);

            await newJob().processVersionEventsAsBulk();

            const values = await metricValues('outbox_version_events_published_total');
            expect(values.reduce((sum, v) => sum + v.value, 0)).toBe(0);
        });
    });

    describe('outbox gauges', () => {
        it('UC-984: version queue by status, oldest pending age and unrecoverable records — own environment only', async () => {
            await insert({ status: 'pending', creationDate: ago(3 * MIN) });
            await insert({ status: 'pending', creationDate: ago(1 * MIN) });
            await insert({ status: 'processing', processingStartedAt: ago(30_000), creationDate: ago(1 * MIN) });
            await insert({ status: 'failed', retryCount: 1, nextAttemptAt: new Date(Date.now() + MIN) });
            // Not counted: another environment, an ordinary event
            await insert({ status: 'pending', environment: 'development', creationDate: ago(90 * 24 * 60 * MIN) });
            await insert({ status: 'pending', eventType: Subjects.StockUpdated, creationDate: ago(60 * MIN) });
            // Unrecoverable: processing without a timestamp / long stuck, failed without retry left
            await insert({ status: 'processing', eventType: Subjects.OrderUpdated, creationDate: ago(90 * 24 * 60 * MIN) });
            await insert({ status: 'processing', processingStartedAt: ago(15 * MIN) });
            await insert({ status: 'failed', eventType: 'catalog:mapping:updated', retryCount: 0 });
            await insert({ status: 'failed', retryCount: 5 });
            newJob();

            const records = await metricValues('outbox_version_records');
            const byStatus = Object.fromEntries(records.map(v => [v.labels.status, v.value]));
            expect(byStatus).toEqual({ pending: 2, processing: 2, failed: 2 });
            records.forEach(v => expect(v.labels.service).toBe('inventory'));

            const [age] = await metricValues('outbox_version_oldest_pending_age_seconds');
            // Oldest pending / processing version record by creationDate (here the default of 1 minute ago or older)
            expect(age.labels).toEqual({ service: 'inventory' });
            expect(age.value).toBeGreaterThanOrEqual(60);

            const unrecovered = Object.fromEntries((await metricValues('outbox_unrecovered_records')).map(v => [v.labels.reason, v.value]));
            expect(unrecovered).toEqual({ processing_stuck: 2, failed_final: 2 });
        });

        it('UC-1211: outbox_records counts non-version events by status — own environment only', async () => {
            await insert({ status: 'pending', eventType: Subjects.StockUpdated });
            await insert({ status: 'pending', eventType: Subjects.OrderUpdated });
            await insert({ status: 'processing', eventType: Subjects.OrderUpdated, processingStartedAt: ago(30_000) });
            await insert({ status: 'failed', eventType: Subjects.StockUpdated, retryCount: 5 });
            await insert({ status: 'failed', eventType: 'catalog:mapping:updated', retryCount: 1, nextAttemptAt: new Date(Date.now() + MIN) });
            await insert({ status: 'failed', eventType: Subjects.StockUpdated, retryCount: 0 });
            // Not counted: version events, another environment, published records
            await insert({ status: 'pending' });
            await insert({ status: 'failed', retryCount: 5 });
            await insert({ status: 'pending', eventType: Subjects.StockUpdated, environment: 'development' });
            await insert({ status: 'failed', eventType: Subjects.StockUpdated, environment: 'development' });
            await insert({ status: 'published', eventType: Subjects.StockUpdated });
            newJob();

            const records = await metricValues('outbox_records');
            const byStatus = Object.fromEntries(records.map(v => [v.labels.status, v.value]));
            expect(byStatus).toEqual({ pending: 2, processing: 1, failed: 3 });
            records.forEach(v => expect(v.labels.service).toBe('inventory'));
        });

        it('UC-1211: outbox_records reports zeros for an empty outbox (alarm sees 0, not "no data")', async () => {
            newJob();

            const byStatus = Object.fromEntries((await metricValues('outbox_records')).map(v => [v.labels.status, v.value]));
            expect(byStatus).toEqual({ pending: 0, processing: 0, failed: 0 });
        });

        it('UC-1211: a service outside the ServiceName enum is labelled with SERVICE_NAME, not "unknown"', async () => {
            process.env.SERVICE_NAME = 'Hepsiburada';
            await insert({ status: 'failed', eventType: Subjects.StockUpdated, retryCount: 5 });
            newJob();

            const failed = (await metricValues('outbox_records')).find(v => v.labels.status === 'failed');
            expect(failed).toEqual(expect.objectContaining({ value: 1, labels: { service: 'hepsiburada', status: 'failed' } }));
        });

        it('UC-1211: without SERVICE_NAME the label stays "unknown"', async () => {
            delete process.env.SERVICE_NAME;
            newJob();

            const records = await metricValues('outbox_records');
            expect(records).toHaveLength(3);
            records.forEach(v => expect(v.labels.service).toBe('unknown'));
        });

        it('empty version queue reports zero age', async () => {
            newJob();

            const [age] = await metricValues('outbox_version_oldest_pending_age_seconds');
            expect(age.value).toBe(0);
        });

        it('a failing collector does not break the scrape: the series is simply absent', async () => {
            EventMetrics.setOutboxCollector('inventory', () => Promise.reject(new Error('mongo down')));

            await expect(EventMetrics.getRegistry().metrics()).resolves.toContain('outbox_version_records');
            expect(await metricValues('outbox_version_records')).toEqual([]);
            expect(await metricValues('outbox_records')).toEqual([]);
        });

        it('the four gauges of one scrape share a single collection run', async () => {
            const collect = jest.fn().mockResolvedValue({
                records: { pending: 2, processing: 0, failed: 1 },
                versionRecords: { pending: 1, processing: 0, failed: 0 },
                versionOldestPendingAgeSeconds: 4,
                stuckProcessing: 0,
                failedFinal: 0
            });
            EventMetrics.setOutboxCollector('orders', collect);

            await EventMetrics.getRegistry().metrics();

            expect(collect).toHaveBeenCalledTimes(1);
        });
    });

    describe('version event write errors', () => {
        it('UC-984: an Outbox write failing after save is counted (the save itself succeeds)', async () => {
            // A connection without the Outbox model: Model.db.model('Outbox') throws inside the post-save hook
            const bare = conn.useDb('uc984_no_outbox', { useCache: false });
            const schema = createBaseSchema(
                { user: String, qty: Number },
                { enableVersionTracking: true, versionTrackingConfig: { entityType: EntityType.ProductStock, serviceName: ServiceName.Inventory } }
            );
            const Probe = bare.model<mongoose.Document & { qty: number }>('Uc984Probe', schema);

            const doc = await Probe.create({ user: 'user-1', qty: 1 });

            expect(doc.id).toBeDefined();
            expect(await metricValues('version_event_write_errors_total'))
                .toEqual([expect.objectContaining({ value: 1, labels: { service: ServiceName.Inventory, entity_type: EntityType.ProductStock } })]);
        });
    });
});
