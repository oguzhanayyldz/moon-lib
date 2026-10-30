import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createBaseSchema, NOT_DELETED } from '../models/base/base.schema';

/** UC-1221: NOT_DELETED sabiti sözleşmesi + find/findOne kancasının aynı kaynaktan beslenmesi. */
jest.setTimeout(120000);

describe('NOT_DELETED', () => {
    it('sözleşme: silinmiş işaretlerinin ikisi de yok', () => {
        expect(NOT_DELETED).toEqual({ deleted: { $exists: false }, deletionDate: { $exists: false } });
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

            const raw = await Probe.collection.find({ ...NOT_DELETED }).toArray();
            const hooked = await Probe.find({});

            expect(raw.map((d: any) => String(d._id))).toEqual([String(live._id)]);
            expect(hooked.map((d: any) => d.id)).toEqual([String(live._id)]);
            expect(await Probe.findByCustom(gone.id)).toBeNull();
            expect(await Probe.findByCustom(live.id)).not.toBeNull();
            expect(NOT_DELETED).toEqual({ deleted: { $exists: false }, deletionDate: { $exists: false } });
        });
    });
});
