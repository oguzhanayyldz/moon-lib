import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createBaseSchema, NOT_DELETED, notDeleted } from '../models/base/base.schema';

/** UC-1221: NOT_DELETED sabiti sözleşmesi + find/findOne kancasının aynı kaynaktan beslenmesi. */
jest.setTimeout(120000);

describe('NOT_DELETED', () => {
    it('sözleşme: silinmiş işaretlerinin ikisi de yok', () => {
        expect(NOT_DELETED).toEqual({ deleted: { $exists: false }, deletionDate: { $exists: false } });
    });

    it('fabrika her çağrıda taze nesne üretir; bir sonucu değiştirmek ötekini etkilemez (UC-1223 B1)', () => {
        const a: any = notDeleted();
        a.deleted.$exists = true;
        expect(notDeleted()).toEqual({ deleted: { $exists: false }, deletionDate: { $exists: false } });
        expect(notDeleted().deleted).not.toBe(notDeleted().deleted);
    });

    describe('gerçek Mongo', () => {
        let rs: MongoMemoryReplSet;
        let conn: mongoose.Connection;
        let Probe: any;

        beforeAll(async () => {
            rs = await MongoMemoryReplSet.create({ binary: { version: '6.0.4' }, replSet: { count: 1, storageEngine: 'wiredTiger' } });
            conn = await mongoose.createConnection(rs.getUri()).asPromise();
            Probe = conn.model('NotDeletedProbe', createBaseSchema({ name: String }));
        });
        afterAll(async () => {
            await conn.close();
            await rs.stop();
        });

        it('NOT_DELETED ham sorguda find kancasıyla aynı kümeyi döner; sorgulardan sonra sabit değişmez', async () => {
            const live = await Probe.create({ name: 'live' });
            const gone = await Probe.create({ name: 'gone' });
            await Probe.collection.updateOne({ _id: gone._id }, { $set: { deleted: true, deletionDate: new Date() } });

            const raw = await Probe.collection.find(notDeleted()).toArray();
            const hooked = await Probe.find({});

            expect(raw.map((d: any) => String(d._id))).toEqual([String(live._id)]);
            expect(hooked.map((d: any) => d.id)).toEqual([String(live._id)]);
            expect(await Probe.findByCustom(gone.id)).toBeNull();
            expect(await Probe.findByCustom(live.id)).not.toBeNull();
            expect(NOT_DELETED).toEqual({ deleted: { $exists: false }, deletionDate: { $exists: false } });
        });

        it('yürütülmüş sorgunun builder\'ına sonradan yazmak sonraki find\'ları etkilemez (UC-1223 B1)', async () => {
            await Probe.deleteMany({});
            await Probe.create({ name: 'live2' });
            const gone = await Probe.create({ name: 'gone2' });
            await Probe.collection.updateOne({ _id: gone._id }, { $set: { deleted: true, deletionDate: new Date() } });

            const q = Probe.find({});
            await q.exec();
            q.where('deleted').exists(true);
            q.where('deletionDate').ne(5);

            const later = await Probe.find({});
            expect(later.map((d: any) => d.name)).toEqual(['live2']);
            expect(await Probe.findOne({ name: 'gone2' })).toBeNull();
            expect(NOT_DELETED).toEqual({ deleted: { $exists: false }, deletionDate: { $exists: false } });
        });
    });
});
