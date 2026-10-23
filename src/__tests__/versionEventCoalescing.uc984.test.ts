/**
 * UC-984 madde 8 — EntityVersionUpdated birleştirme (coalescing), gerçek Mongo (mongodb-memory-server).
 *
 * - Yazım: aynı varlık için bekleyen satır varsa yeni satır açılmaz, sürüm yalnız büyüyerek güncellenir.
 * - Gönderim: aynı partide aynı varlığın birden fazla satırı varsa yalnız en yüksek sürüm gider, diğerleri
 *   'superseded' + supersededBy (silinmez).
 * - Claim'den hemen önce birleştirilen yeni sürüm kaybolmaz (yayıncı claim sonrası okur).
 * - Yalnız entity:version-updated birleştirilir.
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
import { writeVersionEventToOutbox } from '../utils/versionEventOutbox.util';

jest.mock('../services/logger.service', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

jest.setTimeout(120000);

const ENV = 'test';

type JobInternals = { processVersionEventsAsBulk(): Promise<void> };

describe('UC-984 — version event coalescing (real Mongo)', () => {
    let mms: MongoMemoryServer;
    let conn: mongoose.Connection;
    let Outbox: ReturnType<typeof createOutboxModel>;
    let nats: ReturnType<typeof createFakeStan>;
    let previousEnv: string | undefined;
    let previousService: string | undefined;

    const newJob = () => new EventPublisherJob(nats.client, conn) as unknown as JobInternals;
    const oid = () => new mongoose.Types.ObjectId().toString();
    const event = (entityId: string, version: number, extra: Record<string, unknown> = {}) => ({
        entityType: 'product-stock', entityId, service: 'inventory', version, previousVersion: version - 1, userId: 'user-1', ...extra
    });
    const versionRows = (filter: Record<string, unknown> = {}) =>
        Outbox.collection.find({ eventType: Subjects.EntityVersionUpdated, ...filter }).toArray();
    /** Eski pod'un yazdığı gibi: birleştirme yok, her güncelleme yeni satır */
    const insertRaw = async (payload: Record<string, unknown>, fields: Record<string, unknown> = {}) => {
        const doc = {
            _id: new mongoose.Types.ObjectId(),
            uniqueCode: oid(),
            eventType: Subjects.EntityVersionUpdated,
            payload,
            status: 'pending',
            retryCount: 0,
            environment: ENV,
            priority: 5,
            creationDate: new Date(),
            ...fields
        };
        await Outbox.collection.insertOne(doc);
        return doc._id;
    };
    /** Yayınlanan bulk mesajlarındaki updates (fake NATS publish çağrılarından) */
    const sentUpdates = () => nats.publish.mock.calls
        .filter(call => call[0] === Subjects.EntityVersionBulkUpdated)
        .flatMap(call => JSON.parse(call[1] as string).updates as Array<{ entityId: string; version: number }>);
    const counter = async (stage: string) => {
        const metric = (await EventMetrics.getRegistry().getMetricsAsJSON()).find(m => m.name === 'version_events_coalesced_total');
        return ((metric?.values ?? []) as Array<{ value: number; labels: Record<string, string> }>)
            .filter(v => v.labels.stage === stage)
            .reduce((sum, v) => sum + v.value, 0);
    };

    beforeAll(async () => {
        mms = await MongoMemoryServer.create({ binary: { version: '6.0.4' } });
        conn = await mongoose.createConnection(mms.getUri()).asPromise();
        Outbox = createOutboxModel(conn);
        await Outbox.createCollection();
        await Outbox.syncIndexes();
    });

    afterAll(async () => {
        await conn.close();
        await mms.stop();
    });

    let previousCoalesce: string | undefined;
    beforeEach(async () => {
        previousEnv = process.env.NODE_ENV;
        previousService = process.env.SERVICE_NAME;
        process.env.NODE_ENV = ENV;
        process.env.SERVICE_NAME = 'inventory';
        previousCoalesce = process.env.VERSION_EVENT_WRITE_COALESCE;
        process.env.VERSION_EVENT_WRITE_COALESCE = 'true'; // Faz 2 davranışı; Faz 1 (bayrak kapalı) ayrı describe'ta
        EventMetrics.reset();
        nats = createFakeStan();
        await Outbox.deleteMany({});
        jest.restoreAllMocks();
    });

    afterEach(() => {
        process.env.NODE_ENV = previousEnv;
        if (previousCoalesce === undefined) delete process.env.VERSION_EVENT_WRITE_COALESCE;
        else process.env.VERSION_EVENT_WRITE_COALESCE = previousCoalesce;
        if (previousService === undefined) delete process.env.SERVICE_NAME;
        else process.env.SERVICE_NAME = previousService;
    });

    describe('write-time coalescing flag (VERSION_EVENT_WRITE_COALESCE, phase 1 = off)', () => {
        it('flag off (default): every update opens its own row, nothing is merged into a row an old publisher may have read', async () => {
            delete process.env.VERSION_EVENT_WRITE_COALESCE;
            const id = oid();
            for (let v = 1; v <= 5; v++) expect(await writeVersionEventToOutbox(Outbox, event(id, v))).toBe('created');

            expect(await versionRows()).toHaveLength(5);
            expect(await counter('write')).toBe(0);
        });

        it('flag off: old-publisher pattern (row read, newer version written meanwhile) loses nothing, 300/300', async () => {
            delete process.env.VERSION_EVENT_WRITE_COALESCE;
            let lost = 0;
            for (let i = 0; i < 300; i++) {
                const id = oid();
                await writeVersionEventToOutbox(Outbox, event(id, 5));
                const [seen] = await versionRows({ 'payload.entityId': id }); // eski yayıncı: find
                await writeVersionEventToOutbox(Outbox, event(id, 6)); // yeni yazıcı: araya giren güncelleme
                await Outbox.collection.updateOne({ _id: seen._id }, { $set: { status: 'published' } }); // eski yayıncı: claim + published
                const pending = await versionRows({ 'payload.entityId': id, status: 'pending' });
                if (!pending.some(r => r.payload.version === 6)) lost++;
            }
            expect(lost).toBe(0);
        });

        it('flag on: a pending row whose retries are already used is not merged into (the newest version keeps full retries)', async () => {
            const id = oid();
            await insertRaw(event(id, 1), { retryCount: 4 });

            expect(await writeVersionEventToOutbox(Outbox, event(id, 2))).toBe('created');
            const rows = await versionRows({ 'payload.entityId': id });
            expect(rows).toHaveLength(2);
            expect(rows.find(r => r.payload.version === 2)!.retryCount).toBe(0);
        });
    });

    describe('write-time coalescing', () => {
        it('100 consecutive updates of one entity leave ONE pending row; sync receives only the latest version', async () => {
            const id = oid();
            for (let v = 1; v <= 100; v++) await writeVersionEventToOutbox(Outbox, event(id, v));

            const rows = await versionRows();
            expect(rows).toHaveLength(1);
            expect(rows[0].status).toBe('pending');
            expect(rows[0].payload.version).toBe(100);
            expect(rows[0].payload.previousVersion).toBe(99);
            expect(rows[0].coalescedCount).toBe(99);
            expect(await counter('write')).toBe(99);

            await newJob().processVersionEventsAsBulk();
            expect(sentUpdates()).toEqual([expect.objectContaining({ entityId: id, version: 100 })]);
            expect((await versionRows())[0].status).toBe('published');
        });

        it('a late (older) version never overwrites the newer pending one', async () => {
            const id = oid();
            await writeVersionEventToOutbox(Outbox, event(id, 5, { marker: 'v5' }));
            await writeVersionEventToOutbox(Outbox, event(id, 3, { marker: 'v3' }));
            await writeVersionEventToOutbox(Outbox, event(id, 5, { marker: 'v5-again' }));

            const rows = await versionRows();
            expect(rows).toHaveLength(1);
            expect(rows[0].payload.version).toBe(5);
            expect(rows[0].payload.marker).toBe('v5');
            expect(rows[0].coalescedCount).toBe(2);
        });

        it('version-tracked model saves go through coalescing (post-save hook wiring)', async () => {
            const schema = createBaseSchema(
                { name: String, user: String },
                { enableVersionTracking: true, versionTrackingConfig: { entityType: EntityType.ProductStock, serviceName: ServiceName.Inventory } } as any
            );
            const Model = conn.model(`CoalesceStock${Date.now()}`, schema);
            const doc: any = await Model.create({ name: 'n0', user: 'user-1' });
            for (let i = 1; i <= 10; i++) {
                doc.name = `n${i}`;
                await doc.save();
            }

            const rows = await versionRows({ 'payload.entityId': doc.id });
            expect(rows).toHaveLength(1);
            expect(rows[0].payload.version).toBe(doc.version);
            expect(rows[0].payload.entityType).toBe(EntityType.ProductStock);
            expect(rows[0].userId).toBe('user-1'); // create yolu: priority / userId pre-save kancasından
            expect(rows[0].priority).toBe(5);
        });

        it('a row being published (processing) is never touched: a new pending row is opened', async () => {
            const id = oid();
            const claimed = await insertRaw(event(id, 1), { status: 'processing', processingStartedAt: new Date() });

            expect(await writeVersionEventToOutbox(Outbox, event(id, 2))).toBe('created');

            const processing = await Outbox.collection.findOne({ _id: claimed });
            expect(processing?.payload.version).toBe(1);
            expect(processing?.coalescedCount).toBeUndefined();
            expect(await versionRows({ status: 'pending' })).toEqual([expect.objectContaining({ payload: expect.objectContaining({ version: 2 }) })]);
        });

        it('different entity / service / user, another environment or an exhausted pending row is not merged', async () => {
            const id = oid();
            await writeVersionEventToOutbox(Outbox, event(id, 1));
            await writeVersionEventToOutbox(Outbox, event(oid(), 2));
            await writeVersionEventToOutbox(Outbox, event(id, 3, { service: 'orders' }));
            await writeVersionEventToOutbox(Outbox, event(id, 4, { userId: 'user-2' }));
            const other = oid();
            await insertRaw(event(other, 1), { environment: 'production' });
            await insertRaw(event(other, 1), { retryCount: 5 });
            await writeVersionEventToOutbox(Outbox, event(other, 2));

            expect(await versionRows()).toHaveLength(7);
            expect(await counter('write')).toBe(0);
        });

        it('only entity:version-updated is coalesced: a pending event of another type with the same entity stays separate', async () => {
            const id = oid();
            const stockEvent = new mongoose.Types.ObjectId();
            await Outbox.collection.insertOne({
                _id: stockEvent, uniqueCode: oid(), eventType: Subjects.ProductStockUpdated, payload: event(id, 1),
                status: 'pending', retryCount: 0, environment: ENV, priority: 3, creationDate: new Date()
            });

            expect(await writeVersionEventToOutbox(Outbox, event(id, 9))).toBe('created');
            expect((await Outbox.collection.findOne({ _id: stockEvent }))?.payload.version).toBe(1);
            expect(await Outbox.collection.countDocuments({})).toBe(2);
        });

        it('concurrent writes (shuffled versions) lose nothing: after one publish the latest version is sent, the rest superseded', async () => {
            const id = oid();
            const versions = Array.from({ length: 50 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
            await Promise.all(versions.map(v => writeVersionEventToOutbox(Outbox, event(id, v))));

            const pending = await versionRows({ status: 'pending' });
            expect(Math.max(...pending.map(r => r.payload.version))).toBe(50);

            await newJob().processVersionEventsAsBulk();

            expect(sentUpdates()).toEqual([expect.objectContaining({ entityId: id, version: 50 })]);
            const rows = await versionRows();
            expect(rows.filter(r => r.status === 'pending' || r.status === 'processing')).toHaveLength(0);
            const winner = rows.find(r => r.status === 'published');
            expect(winner?.payload.version).toBe(50);
            const superseded = rows.filter(r => r.status === 'superseded');
            expect(superseded).toHaveLength(rows.length - 1);
            superseded.forEach(r => expect(r.supersededBy).toBe(String(winner?._id)));
        });
    });

    describe('send-time coalescing (mixed old / new pods)', () => {
        it('rows written by old pods (one per update) are collapsed: only the highest version per entity is sent', async () => {
            const a = oid();
            const b = oid();
            const a1 = await insertRaw(event(a, 1));
            const a3 = await insertRaw(event(a, 3));
            const a2 = await insertRaw(event(a, 2));
            const b1 = await insertRaw(event(b, 1));

            await newJob().processVersionEventsAsBulk();

            const sent = sentUpdates();
            expect(sent).toHaveLength(2);
            expect(sent).toEqual(expect.arrayContaining([
                expect.objectContaining({ entityId: a, version: 3 }),
                expect.objectContaining({ entityId: b, version: 1 })
            ]));
            const status = async (id: mongoose.Types.ObjectId) => Outbox.collection.findOne({ _id: id });
            expect((await status(a3))?.status).toBe('published');
            expect((await status(b1))?.status).toBe('published');
            for (const loser of [a1, a2]) {
                const row = await status(loser);
                expect(row?.status).toBe('superseded');
                expect(row?.supersededBy).toBe(String(a3));
            }
            expect(await counter('send')).toBe(2);
            expect(sent.length + (await counter('send'))).toBe(4); // gönderilen + birleştirilen = yazılan
        });

        it('publish failure: nothing is superseded, every row goes to failed and is collapsed again on retry', async () => {
            const a = oid();
            await insertRaw(event(a, 1));
            await insertRaw(event(a, 2));
            nats.setPublishFails(true);

            await newJob().processVersionEventsAsBulk();

            const rows = await versionRows();
            expect(rows.map(r => r.status).sort()).toEqual(['failed', 'failed']);
            expect(await counter('send')).toBe(0);
        });

        it('a version coalesced between the candidate read and the claim is the one that is sent (no lost update)', async () => {
            const id = oid();
            await writeVersionEventToOutbox(Outbox, event(id, 1));
            const job = newJob();
            const originalUpdateMany = Outbox.updateMany.bind(Outbox);
            let injected = false;
            jest.spyOn(Outbox, 'updateMany').mockImplementation(((filter: any, update: any, ...rest: any[]) => {
                if (!injected && update?.$set?.status === 'processing') {
                    injected = true;
                    // yayıncı adayları okudu; claim'den hemen önce bir başka pod sürümü 2'ye çıkarır
                    return writeVersionEventToOutbox(Outbox, event(id, 2)).then(() => originalUpdateMany(filter, update, ...rest));
                }
                return originalUpdateMany(filter, update, ...rest);
            }) as any);

            await job.processVersionEventsAsBulk();

            expect(injected).toBe(true);
            expect(sentUpdates()).toEqual([expect.objectContaining({ entityId: id, version: 2 })]);
            const rows = await versionRows();
            expect(rows).toHaveLength(1);
            expect(rows[0].status).toBe('published');
            expect(rows[0].payload.version).toBe(2);
        });
    });
});
