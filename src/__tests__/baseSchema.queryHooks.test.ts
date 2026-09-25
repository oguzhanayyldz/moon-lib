import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createBaseSchema } from '../models/base/base.schema';
import { createOutboxModel } from '../models/outbox.schema';
import { EntityType, ServiceName } from '../common/types/entity.types';
import { Subjects } from '../common/events/subjects';

/**
 * base.schema pre('findOneAndUpdate') / pre('updateOne') — updatedOn eklenir, sorgu `op`'u korunur
 * (TASK-MUHKJ49C3M25J PR-B).
 *
 * Eskiden pre kancası `this.updateOne(filter, ...)` çağırıyordu; Query.updateOne `op`'u 'updateOne'
 * yaptığı için hiçbir post('findOneAndUpdate') kancası çalışmıyordu (lean-id kancası dahil).
 * EVU kancası PR-A'da silindiği için post kancalarının canlanması EVU üretmez.
 */
jest.setTimeout(120000);

interface ProbeAttrs { user?: string; qty?: number; note?: string }
type ProbeDoc = mongoose.Document & ProbeAttrs & { version: number; updatedOn: Date };

describe('base.schema sorgu kancaları (gerçek Mongo)', () => {
    let rs: MongoMemoryReplSet;
    let conn: mongoose.Connection;
    let Probe: mongoose.Model<ProbeDoc>;
    let Outbox: ReturnType<typeof createOutboxModel>;
    const postOps: string[] = [];

    beforeAll(async () => {
        rs = await MongoMemoryReplSet.create({
            binary: { version: '6.0.4' },
            replSet: { count: 1, storageEngine: 'wiredTiger' }
        });
        conn = await mongoose.createConnection(rs.getUri()).asPromise();
        Outbox = createOutboxModel(conn);

        const schema = createBaseSchema(
            { user: String, qty: Number, note: String },
            {
                enableVersionTracking: true,
                versionTrackingConfig: { entityType: EntityType.Combination, serviceName: ServiceName.Products }
            }
        );
        // Base kancalarından SONRA kaydedilen gözlemci: hangi post listesinin çalıştığını yazar
        schema.post('findOneAndUpdate', function (this: any) { postOps.push(`findOneAndUpdate:${this.op}`); });
        schema.post('updateOne', function (this: any) { postOps.push(`updateOne:${this.op}`); });
        Probe = conn.model<ProbeDoc>('Combination', schema);
        await Promise.all([Probe.createCollection(), Outbox.createCollection()]);
    });

    afterAll(async () => {
        await conn.close();
        await rs.stop();
    });

    beforeEach(async () => {
        await Promise.all([Probe.deleteMany({}), Outbox.deleteMany({})]);
        postOps.length = 0;
    });

    const OLD = new Date('2020-01-01T00:00:00.000Z');

    /** updatedOn'u kancasız (ham koleksiyon) geçmişe çeker; create EVU'su sayıma girmez */
    const seedStale = async (): Promise<string> => {
        const doc = await Probe.create({ user: new mongoose.Types.ObjectId().toHexString(), qty: 1 });
        await Probe.collection.updateOne({ _id: doc._id }, { $set: { updatedOn: OLD } });
        await Outbox.deleteMany({});
        postOps.length = 0;
        return doc.id;
    };

    const rawUpdatedOn = async (id: string) =>
        ((await Probe.collection.findOne({ _id: new mongoose.Types.ObjectId(id) })) as any).updatedOn as Date;

    const evuCount = () => Outbox.countDocuments({ eventType: Subjects.EntityVersionUpdated });

    it('findOneAndUpdate: updatedOn ilerler, post(\'findOneAndUpdate\') op=findOneAndUpdate ile çalışır', async () => {
        const id = await seedStale();

        const doc = await Probe.findOneAndUpdate({ _id: id }, { $set: { qty: 2 } }, { new: true });

        expect(doc!.qty).toBe(2);
        expect((await rawUpdatedOn(id)).getTime()).toBeGreaterThan(OLD.getTime());
        expect(postOps).toEqual(['findOneAndUpdate:findOneAndUpdate']);
    });

    it('findByIdAndUpdate ($inc version) de aynı: op korunur, updatedOn ilerler, EVU YOK', async () => {
        const id = await seedStale();

        await Probe.findByIdAndUpdate(id, { $inc: { version: 1 } }, { new: true });

        expect((await rawUpdatedOn(id)).getTime()).toBeGreaterThan(OLD.getTime());
        expect(postOps).toEqual(['findOneAndUpdate:findOneAndUpdate']);
        expect(await evuCount()).toBe(0);
    });

    it('updateOne: updatedOn ilerler, post(\'updateOne\') çalışır', async () => {
        const id = await seedStale();

        await Probe.updateOne({ _id: id }, { $set: { note: 'x' } });

        const raw: any = await Probe.collection.findOne({ _id: new mongoose.Types.ObjectId(id) });
        expect(raw.note).toBe('x');
        expect(raw.updatedOn.getTime()).toBeGreaterThan(OLD.getTime());
        expect(postOps).toEqual(['updateOne:updateOne']);
    });

    it('lean findOneAndUpdate sonucuna `id` eklenir (lean-id kancası çalışır)', async () => {
        const id = await seedStale();

        const doc: any = await Probe.findOneAndUpdate({ _id: id }, { $set: { qty: 3 } }, { new: true }).lean();

        expect(doc.id).toBe(id);
    });

    it('pipeline (dizi) güncellemede updatedOn $set aşamasıyla ilerler', async () => {
        const id = await seedStale();

        const doc: any = await Probe.findOneAndUpdate({ _id: id }, [{ $set: { qty: 7 } }], { new: true }).lean();

        expect(doc.qty).toBe(7);
        expect((await rawUpdatedOn(id)).getTime()).toBeGreaterThan(OLD.getTime());
    });

    it('eski birleştirme korunur: çağıranın $set.updatedOn\'u ezilir, üst seviye (operatörsüz) updatedOn korunur', async () => {
        const viaSet = await seedStale();
        await Probe.findOneAndUpdate({ _id: viaSet }, { $set: { note: 'a', updatedOn: OLD } });
        expect((await rawUpdatedOn(viaSet)).getTime()).toBeGreaterThan(OLD.getTime());

        const topLevel = await seedStale();
        await Probe.findOneAndUpdate({ _id: topLevel }, { note: 'b', updatedOn: OLD } as any);
        expect((await rawUpdatedOn(topLevel)).getTime()).toBe(OLD.getTime());

        const topLevelUpdateOne = await seedStale();
        await Probe.updateOne({ _id: topLevelUpdateOne }, { note: 'c', updatedOn: OLD } as any);
        expect((await rawUpdatedOn(topLevelUpdateOne)).getTime()).toBe(OLD.getTime());
    });

    it('eşleşmeyen findOneAndUpdate belge oluşturmaz, EVU yazmaz', async () => {
        const doc = await Probe.findOneAndUpdate({ _id: new mongoose.Types.ObjectId() }, { $set: { qty: 1 } }, { new: true });

        expect(doc).toBeNull();
        expect(await Probe.countDocuments({})).toBe(0);
        expect(await evuCount()).toBe(0);
    });
});
