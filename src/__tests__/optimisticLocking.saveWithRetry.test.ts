import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { updateIfCurrentPlugin } from 'mongoose-update-if-current';
import { OptimisticLockingUtil } from '../utils/optimisticLocking.util';

/**
 * saveWithRetry bayat sürüm davranışı — GERÇEK Mongo (mongodb-memory-server) + base.schema ile aynı
 * sürüm kilidi (versionKey='version' + updateIfCurrentPlugin). TASK-MUEM4VTE4HLFW.
 *
 * Kök neden: save `{ _id, version: <bellekteki> }` ile koşullanır; bellekteki belge bayatsa aynı belgeyi
 * tekrar kaydetmek her seferinde aynı VersionError'u verir (bellekteki sürüm denemeler arasında değişmez).
 */
jest.setTimeout(60000);

interface ProbeAttrs { a: number; b: number; counter: number }
type ProbeDoc = mongoose.Document & ProbeAttrs & { version: number };

describe('OptimisticLockingUtil.saveWithRetry — bayat sürüm (gerçek Mongo)', () => {
    let mms: MongoMemoryServer;
    let Probe: mongoose.Model<ProbeDoc>;

    beforeAll(async () => {
        mms = await MongoMemoryServer.create({ binary: { version: '6.0.4' } });
        await mongoose.connect(mms.getUri());
        const schema = new mongoose.Schema({ a: Number, b: Number, counter: Number });
        schema.set('versionKey', 'version');
        schema.plugin(updateIfCurrentPlugin);
        Probe = mongoose.model<ProbeDoc>('SaveWithRetryProbe', schema);
    });

    afterAll(async () => {
        await mongoose.disconnect();
        await mms.stop();
    });

    beforeEach(async () => {
        await Probe.deleteMany({});
    });

    /** Aynı belgenin iki kopyası: `stale` okunduktan sonra `other` araya girip kaydeder. */
    const staleCopy = async () => {
        const created = await Probe.create({ a: 1, b: 1, counter: 10 });
        const stale = (await Probe.findById(created.id))!;
        const other = (await Probe.findById(created.id))!;
        other.b = 99;
        other.counter = other.counter + 1;
        await other.save(); // version 0 -> 1
        return { id: created.id as string, stale };
    };

    it('reapply verilince belge yeniden okunur, değişiklik taze belgeye uygulanır, eşzamanlı yazım korunur', async () => {
        const { id, stale } = await staleCopy();
        const apply = (doc: ProbeDoc) => { doc.a = 2; };
        apply(stale);

        const saved = await OptimisticLockingUtil.saveWithRetry(stale, 'probe', undefined, apply);

        const db = (await Probe.findById(id).lean())!;
        expect(db).toMatchObject({ a: 2, b: 99, counter: 11, version: 2 });
        expect(saved.version).toBe(2);
        expect(saved).not.toBe(stale); // taze belge döner
    });

    it('reapply değeri TAZE belgeden hesaplar: eşzamanlı artış kaybolmaz (lost update yok)', async () => {
        const { id, stale } = await staleCopy();
        const inc = (doc: ProbeDoc) => { doc.counter = doc.counter + 5; };
        inc(stale); // bayat: 10 + 5 = 15

        await OptimisticLockingUtil.saveWithRetry(stale, 'probe', undefined, inc);

        const db = (await Probe.findById(id).lean())!;
        expect(db.counter).toBe(16); // taze 11 + 5; bayat 15 yazılsaydı öteki artış kaybolurdu
    });

    it('reapply yoksa sürüm hatası tek denemede fırlar (aynı belgeyi 5 kez kaydetmek sonucu değiştirmez)', async () => {
        const { id, stale } = await staleCopy();
        stale.a = 2;
        const saveSpy = jest.spyOn(stale, 'save');

        await expect(OptimisticLockingUtil.saveWithRetry(stale, 'probe')).rejects.toThrow(/No matching document found/);

        expect(saveSpy).toHaveBeenCalledTimes(1);
        const db = (await Probe.findById(id).lean())!;
        expect(db).toMatchObject({ a: 1, b: 99, version: 1 }); // hiçbir şey ezilmedi
    });

    it('çakışma yoksa reapply hiç çağrılmaz, aynı belge döner', async () => {
        const created = await Probe.create({ a: 1, b: 1, counter: 0 });
        const doc = (await Probe.findById(created.id))!;
        doc.a = 3;
        const reapply = jest.fn();

        const saved = await OptimisticLockingUtil.saveWithRetry(doc, 'probe', undefined, reapply);

        expect(reapply).not.toHaveBeenCalled();
        expect(saved).toBe(doc);
        expect((await Probe.findById(created.id).lean())!).toMatchObject({ a: 3, version: 1 });
    });

    it('belge arada silindiyse "Document not found" ile biter, tekrar denenmez', async () => {
        const { id, stale } = await staleCopy();
        await Probe.deleteOne({ _id: id });
        stale.a = 2;
        const reapply = jest.fn();

        await expect(OptimisticLockingUtil.saveWithRetry(stale, 'probe', undefined, reapply)).rejects.toThrow(/Document not found/);
        expect(reapply).not.toHaveBeenCalled();
    });

    // Session/transaction davranışı gerçek replica set ister: optimisticLocking.saveWithRetry.replset.test.ts
});
