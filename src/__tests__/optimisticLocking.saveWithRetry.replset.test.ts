import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { updateIfCurrentPlugin } from 'mongoose-update-if-current';
import { OptimisticLockingUtil } from '../utils/optimisticLocking.util';

/**
 * saveWithRetry + reapply — session/transaction davranışı, GERÇEK replica set (transaction için şart).
 * TASK-MUEM4VTE4HLFW tur 2 (inceleme bulgusu B1 + N1 lead kararı).
 *
 * B1: mongoose save, `options.session` yoksa belgenin `$session()`'ını kullanır (model.js:290-293).
 * Belge transaction session'ına bağlıyken `session` parametresi verilmezse yeniden okuma ve taze
 * belgenin kaydı transaction DIŞINA gidiyordu; abort sonrası yazım DB'de kalıyordu.
 * N1: transaction içinde yeniden okuma aynı session ile yapılır (snapshot, bellekteki bayat sürümden
 * yenidir; VersionError'un transaction içinde oluşmasının tek yolu budur).
 */
jest.setTimeout(120000);

interface ProbeAttrs { a: number; b: number; counter: number }
type ProbeDoc = mongoose.Document & ProbeAttrs & { version: number };

describe('OptimisticLockingUtil.saveWithRetry — session/transaction (gerçek replica set)', () => {
    let rs: MongoMemoryReplSet;
    let conn: mongoose.Connection;
    let Probe: mongoose.Model<ProbeDoc>;

    beforeAll(async () => {
        rs = await MongoMemoryReplSet.create({
            binary: { version: '6.0.4' },
            replSet: { count: 1, storageEngine: 'wiredTiger' }
        });
        conn = await mongoose.createConnection(rs.getUri()).asPromise();
        const schema = new mongoose.Schema({ a: Number, b: Number, counter: Number });
        schema.set('versionKey', 'version');
        schema.plugin(updateIfCurrentPlugin);
        Probe = conn.model<ProbeDoc>('SaveWithRetryTxProbe', schema);
        await Probe.createCollection(); // transaction içinde koleksiyon oluşturmaya düşmesin
    });

    afterAll(async () => {
        await conn.close();
        await rs.stop();
    });

    beforeEach(async () => {
        await Probe.deleteMany({});
    });

    /** `stale` (version 0) okunduktan sonra başka bir yazar commit eder: DB version 1, b=5. */
    const staleCopy = async () => {
        const created = await Probe.create({ a: 0, b: 0, counter: 10 });
        const stale = (await Probe.findById(created.id))!;
        await Probe.findById(created.id).then(async (other) => {
            other!.b = 5;
            other!.counter = other!.counter + 1;
            await other!.save(); // version 0 -> 1
        });
        return { id: created.id as string, stale };
    };

    const dbState = async (id: string) => {
        const doc = (await Probe.findById(id).lean())!;
        return { a: doc.a, b: doc.b, counter: doc.counter, version: doc.version };
    };

    it('B1: belge transaction session\'ına BAĞLI, parametre yok → yeniden okuma/kayıt transaction içinde kalır, abort geri alır', async () => {
        const { id, stale } = await staleCopy();
        const session = await conn.startSession();
        const reapply = jest.fn((doc: ProbeDoc) => { doc.a = 42; });
        let saved: ProbeDoc;
        let savedSession: mongoose.ClientSession | null;
        try {
            session.startTransaction();
            stale.$session(session); // ör. Stock.find(...).session(session) ile okunmuş belge
            reapply(stale);

            saved = await OptimisticLockingUtil.saveWithRetry(stale, 'probe', undefined, reapply);
            savedSession = saved.$session();
            await session.abortTransaction();
        } finally {
            await session.endSession();
        }

        expect(await dbState(id)).toEqual({ a: 0, b: 5, counter: 11, version: 1 }); // transaction dışına sızan yazım yok
        expect(reapply).toHaveBeenCalledTimes(2); // çağıranın ilk uygulaması + taze belgeye yeniden uygulama
        expect(saved).not.toBe(stale);
        expect(savedSession).toBe(session);
    });

    it('B1: aynı senaryoda commit → değişiklik taze belge üzerinden kalıcı, eşzamanlı yazım korunur', async () => {
        const { id, stale } = await staleCopy();
        const session = await conn.startSession();
        const inc = (doc: ProbeDoc) => { doc.counter = doc.counter + 5; };
        try {
            session.startTransaction();
            stale.$session(session);
            inc(stale); // bayat: 10 + 5 = 15

            await OptimisticLockingUtil.saveWithRetry(stale, 'probe', undefined, inc);
            await session.commitTransaction();
        } finally {
            await session.endSession();
        }

        expect(await dbState(id)).toEqual({ a: 0, b: 5, counter: 16, version: 2 }); // taze 11 + 5
    });

    it('N1: session PARAMETRESİ transaction içinde → aynı session ile yeniden okunur; abort geri alır, commit kalıcılaştırır', async () => {
        const { id, stale } = await staleCopy();
        const apply = (doc: ProbeDoc) => { doc.a = 7; };

        const aborted = await conn.startSession();
        try {
            aborted.startTransaction();
            apply(stale);
            const saved = await OptimisticLockingUtil.saveWithRetry(stale, 'probe', aborted, apply);
            expect(saved.$session()).toBe(aborted);
            await aborted.abortTransaction();
        } finally {
            await aborted.endSession();
        }
        expect(await dbState(id)).toEqual({ a: 0, b: 5, counter: 11, version: 1 });

        const stale2 = (await Probe.findById(id))!;
        await Probe.updateOne({ _id: id }, { $set: { b: 6 }, $inc: { version: 1 } }); // stale2 yine bayat (version 2)
        const committed = await conn.startSession();
        try {
            committed.startTransaction();
            apply(stale2);
            await OptimisticLockingUtil.saveWithRetry(stale2, 'probe', committed, apply);
            await committed.commitTransaction();
        } finally {
            await committed.endSession();
        }
        expect(await dbState(id)).toEqual({ a: 7, b: 6, counter: 11, version: 3 });
    });

    it('transaction snapshot\'ından SONRA gelen eşzamanlı commit → WriteConflict tek denemede fırlar, reapply çağrılmaz', async () => {
        const created = await Probe.create({ a: 0, b: 0, counter: 0 });
        const session = await conn.startSession();
        const reapply = jest.fn();
        try {
            session.startTransaction();
            const inTx = (await Probe.findById(created.id).session(session))!; // snapshot burada sabitlenir
            await Probe.updateOne({ _id: created.id }, { $set: { b: 9 }, $inc: { version: 1 } }); // transaction dışı commit
            inTx.a = 1;
            const saveSpy = jest.spyOn(inTx, 'save');

            await expect(OptimisticLockingUtil.saveWithRetry(inTx, 'probe', undefined, reapply)).rejects.toThrow(/WriteConflict/);
            expect(saveSpy).toHaveBeenCalledTimes(1);
            expect(reapply).not.toHaveBeenCalled();
            await session.abortTransaction();
        } finally {
            await session.endSession();
        }
        expect(await dbState(created.id)).toEqual({ a: 0, b: 9, counter: 0, version: 1 });
    });

    it('transaction dışı session parametresi → taze belge aynı session\'a bağlı döner', async () => {
        const { id, stale } = await staleCopy();
        const session = await conn.startSession();
        const apply = (doc: ProbeDoc) => { doc.a = 8; };
        try {
            apply(stale);
            const saved = await OptimisticLockingUtil.saveWithRetry(stale, 'probe', session, apply);
            expect(saved.$session()).toBe(session);
        } finally {
            await session.endSession();
        }
        expect(await dbState(id)).toEqual({ a: 8, b: 5, counter: 11, version: 2 });
    });

    it('belge BİTMİŞ bir session\'a bağlıysa session yok sayılır, yeniden okuma normal çalışır', async () => {
        const { id, stale } = await staleCopy();
        const session = await conn.startSession();
        stale.$session(session);
        await session.endSession(); // $session() artık null döner (document.js:909-912)
        const apply = (doc: ProbeDoc) => { doc.a = 3; };
        apply(stale);

        await OptimisticLockingUtil.saveWithRetry(stale, 'probe', undefined, apply);

        expect(await dbState(id)).toEqual({ a: 3, b: 5, counter: 11, version: 2 });
    });
});
