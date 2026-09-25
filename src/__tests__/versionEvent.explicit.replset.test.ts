import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createBaseSchema } from '../models/base/base.schema';
import { createOutboxModel } from '../models/outbox.schema';
import { OptimisticLockingUtil } from '../utils/optimisticLocking.util';
import { EntityType, ServiceName } from '../common/types/entity.types';
import { Subjects } from '../common/events/subjects';

/**
 * EntityVersionUpdated (EVU) sözleşmesi — sorgu yazımları EVU'yu YALNIZ açıkça üretir (TASK-MUHKJ49C3M25J).
 *
 * base.schema'daki post('findOneAndUpdate') EVU kancası hiç çalışmamıştı ve silindi; EVU'yu
 * OptimisticLockingUtil (updateWithRetry / updateMetadataWithRetry / applyVersionedUpdate /
 * publishVersionEvent) yazar. Gerçek Mongo (replica set, transaction için) + gerçek Outbox modeli.
 */
jest.setTimeout(120000);

interface ProbeAttrs { user?: string; qty?: number; note?: string }
type ProbeDoc = mongoose.Document & ProbeAttrs & { version: number; updatedOn: Date };

describe('EVU — sorgu yazımlarında açık yayın (gerçek replica set)', () => {
    let rs: MongoMemoryReplSet;
    let conn: mongoose.Connection;
    let Tracked: mongoose.Model<ProbeDoc>;
    let Untracked: mongoose.Model<ProbeDoc>;
    let Outbox: ReturnType<typeof createOutboxModel>;

    beforeAll(async () => {
        rs = await MongoMemoryReplSet.create({
            binary: { version: '6.0.4' },
            replSet: { count: 1, storageEngine: 'wiredTiger' }
        });
        conn = await mongoose.createConnection(rs.getUri()).asPromise();
        Outbox = createOutboxModel(conn);

        // Model adı 'Product' ↔ entityType 'product': util config'i modelName ile eşler
        const trackedSchema = createBaseSchema(
            { user: String, qty: Number, note: String },
            {
                enableVersionTracking: true,
                versionTrackingConfig: { entityType: EntityType.Product, serviceName: ServiceName.Products }
            }
        );
        Tracked = conn.model<ProbeDoc>('Product', trackedSchema);
        Untracked = conn.model<ProbeDoc>('EvuUntrackedProbe', createBaseSchema({ user: String, qty: Number, note: String }));
        await Promise.all([Tracked.createCollection(), Untracked.createCollection(), Outbox.createCollection()]);
    });

    afterAll(async () => {
        await conn.close();
        await rs.stop();
    });

    beforeEach(async () => {
        await Promise.all([Tracked.deleteMany({}), Untracked.deleteMany({}), Outbox.deleteMany({})]);
    });

    const evus = async (id?: string) => {
        const rows = await Outbox.find({
            eventType: Subjects.EntityVersionUpdated,
            ...(id ? { 'payload.entityId': id } : {})
        }).lean();
        return rows.map((row: any) => ({
            version: row.payload.version,
            previousVersion: row.payload.previousVersion,
            source: row.payload.metadata?.source
        }));
    };

    /** create'in post('save') EVU'su sayıma girmesin */
    const seed = async (Model: mongoose.Model<ProbeDoc> = Tracked): Promise<string> => {
        const doc = await Model.create({ user: new mongoose.Types.ObjectId().toHexString(), qty: 1 });
        await Outbox.deleteMany({});
        return doc.id;
    };

    describe('publishVersionEvent (açık yardımcı)', () => {
        it('post-image ile tek EVU yazar: version = doc.version, previousVersion = version - 1', async () => {
            const id = await seed();
            const post = await Tracked.findOneAndUpdate({ _id: id }, { $inc: { version: 1 } }, { new: true });

            const written = await OptimisticLockingUtil.publishVersionEvent(Tracked, post);

            expect(written).toBe(true);
            expect(await evus(id)).toEqual([{ version: 1, previousVersion: 0, source: 'explicit' }]);
            const row: any = await Outbox.findOne({ 'payload.entityId': id }).lean();
            expect(row.payload).toMatchObject({ entityType: EntityType.Product, service: ServiceName.Products });
            expect(row.payload.userId).toBe(post!.user);
        });

        it('new:false ön görüntüsünde çağıranın verdiği sürümü yayınlar (pre.version + 1 = DB sürümü)', async () => {
            const id = await seed();
            const pre = await Tracked.findOneAndUpdate({ _id: id }, { $inc: { version: 1 } }, { new: false });

            await OptimisticLockingUtil.publishVersionEvent(Tracked, pre, { version: pre!.version + 1, source: 'claim' });

            const db = await Tracked.findById(id).lean();
            expect(await evus(id)).toEqual([{ version: db!.version, previousVersion: db!.version - 1, source: 'claim' }]);
        });

        it('sürüm izlemesiz modelde yazmaz, false döner', async () => {
            const id = await seed(Untracked);
            const post = await Untracked.findOneAndUpdate({ _id: id }, { $inc: { version: 1 } }, { new: true });

            expect(await OptimisticLockingUtil.publishVersionEvent(Untracked, post)).toBe(false);
            expect(await evus()).toEqual([]);
        });

        it('belge ya da sürüm yoksa yazmaz, false döner (fırlatmaz)', async () => {
            expect(await OptimisticLockingUtil.publishVersionEvent(Tracked, null)).toBe(false);
            expect(await OptimisticLockingUtil.publishVersionEvent(Tracked, { _id: new mongoose.Types.ObjectId() })).toBe(false);
            expect(await evus()).toEqual([]);
        });

        it('Outbox yazımı hata verirse fırlatmaz, false döner', async () => {
            const id = await seed();
            const post = await Tracked.findById(id);
            const spy = jest.spyOn(Outbox, 'create').mockRejectedValueOnce(new Error('outbox down') as never);
            try {
                await expect(OptimisticLockingUtil.publishVersionEvent(Tracked, post)).resolves.toBe(false);
            } finally {
                spy.mockRestore();
            }
        });

        it('session verilirse EVU transaction\'a girer: abort geri alır, commit yazar', async () => {
            const id = await seed();

            const aborted = await conn.startSession();
            try {
                aborted.startTransaction();
                const post = await Tracked.findOneAndUpdate({ _id: id }, { $inc: { version: 1 } }, { new: true, session: aborted });
                expect(await OptimisticLockingUtil.publishVersionEvent(Tracked, post, { session: aborted })).toBe(true);
                await aborted.abortTransaction();
            } finally {
                await aborted.endSession();
            }
            expect(await evus(id)).toEqual([]);
            expect((await Tracked.findById(id).lean())!.version).toBe(0);

            const committed = await conn.startSession();
            try {
                committed.startTransaction();
                const post = await Tracked.findOneAndUpdate({ _id: id }, { $inc: { version: 1 } }, { new: true, session: committed });
                await OptimisticLockingUtil.publishVersionEvent(Tracked, post, { session: committed });
                await committed.commitTransaction();
            } finally {
                await committed.endSession();
            }
            expect(await evus(id)).toEqual([{ version: 1, previousVersion: 0, source: 'explicit' }]);
        });
    });

    describe('sorgu yazımında kanca EVU\'su yok — util yolları TEK EVU', () => {
        it('ham findOneAndUpdate ($inc version, new:true) kendiliğinden EVU üretmez', async () => {
            const id = await seed();
            await Tracked.findOneAndUpdate({ _id: id }, { $inc: { version: 1 } }, { new: true });
            expect(await evus(id)).toEqual([]);
        });

        it('ham findOneAndUpdate (sürüme dokunmayan $set) EVU üretmez', async () => {
            const id = await seed();
            await Tracked.findOneAndUpdate({ _id: id }, { $set: { note: 'x' } });
            expect(await evus(id)).toEqual([]);
        });

        it('updateWithRetry $set.version → tek EVU', async () => {
            const id = await seed();
            await OptimisticLockingUtil.updateWithRetry(Tracked, id, { $set: { qty: 2, version: 1 } });
            expect(await evus(id)).toEqual([{ version: 1, previousVersion: 0, source: 'updateWithRetry' }]);
        });

        it('updateMetadataWithRetry sürümsüz → EVU yok; sürümlü → tek EVU', async () => {
            const id = await seed();
            await OptimisticLockingUtil.updateMetadataWithRetry(Tracked, id, { $set: { note: 'meta' } });
            expect(await evus(id)).toEqual([]);
            await OptimisticLockingUtil.updateMetadataWithRetry(Tracked, id, { $set: { version: 1 } });
            expect(await evus(id)).toEqual([{ version: 1, previousVersion: 0, source: 'updateWithRetry' }]);
        });

        it('applyVersionedUpdate (applied) → tek EVU', async () => {
            const id = await seed();
            const result = await OptimisticLockingUtil.applyVersionedUpdate(Tracked, id, 1, { qty: 5 });
            expect(result.outcome).toBe('applied');
            expect(await evus(id)).toEqual([{ version: 1, previousVersion: 0, source: 'updateWithRetry' }]);
        });
    });
});
