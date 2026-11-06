import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { OptimisticLockingUtil } from '../utils/optimisticLocking.util';
import { VERSION_TRACKING_CONFIGS } from '../models/base/base.schema';
import { createOutboxModel } from '../models/outbox.schema';
import { Subjects } from '../common/events/subjects';

jest.mock('../services/logger.service', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

/**
 * UC-835 (F-58): updateWithRetry sürüm yazdığında EntityVersionUpdated Outbox satırını çağıranın session'ı ile yazar.
 * Önceden session yalnız findByIdAndUpdate'e gidiyor, EVU satırı transaction DIŞINDA yazılıyordu: transaction abort
 * edilse de satır kalıyor ve yayıncı hiç gerçekleşmemiş bir sürümü downstream'e duyuruyordu.
 * GERÇEK replica set (transaction için şart).
 */
jest.setTimeout(120000);

const ENTITY_TYPE = 'uc835-probe';

describe('OptimisticLockingUtil.updateWithRetry — EVU Outbox satırı session ile (UC-835)', () => {
    let rs: MongoMemoryReplSet;
    let conn: mongoose.Connection;
    let Probe: mongoose.Model<any>;
    let Outbox: ReturnType<typeof createOutboxModel>;

    beforeAll(async () => {
        rs = await MongoMemoryReplSet.create({
            binary: { version: '6.0.4' },
            replSet: { count: 1, storageEngine: 'wiredTiger' }
        });
        conn = await mongoose.createConnection(rs.getUri()).asPromise();
        const schema = new mongoose.Schema({ a: Number, version: Number, user: String });
        Probe = conn.model('Uc835Probe', schema);
        Outbox = createOutboxModel(conn);
        await Probe.createCollection();
        await Outbox.createCollection();
        // Arka plan indeks kurulumu koleksiyonu kilitler; transaction içindeki Outbox yazımı "Unable to acquire IX lock" alır
        await Outbox.syncIndexes();
        VERSION_TRACKING_CONFIGS.set(ENTITY_TYPE, {
            enableVersionTracking: true,
            versionTrackingConfig: { entityType: ENTITY_TYPE, serviceName: 'orders' }
        });
    });

    afterAll(async () => {
        VERSION_TRACKING_CONFIGS.delete(ENTITY_TYPE);
        await conn.close();
        await rs.stop();
    });

    beforeEach(async () => {
        await Probe.deleteMany({});
        await Outbox.deleteMany({});
    });

    const evuRows = () => Outbox.countDocuments({ eventType: Subjects.EntityVersionUpdated });

    it('transaction abort edilirse EVU satırı da geri alınır', async () => {
        const created = await Probe.create({ a: 0, version: 1, user: 'u1' });
        const session = await conn.startSession();
        try {
            session.startTransaction();
            await OptimisticLockingUtil.updateWithRetry(
                Probe, created.id, { $set: { a: 1, version: 2 } }, {}, 'probe', session
            );
            await session.abortTransaction();
        } finally {
            await session.endSession();
        }

        expect(((await Probe.findById(created.id).lean()) as any).version).toBe(1);
        expect(await evuRows()).toBe(0);
    });

    it('updateMetadataWithRetry: transaction abort edilirse EVU satırı da geri alınır', async () => {
        const created = await Probe.create({ a: 0, version: 1, user: 'u1' });
        const session = await conn.startSession();
        try {
            session.startTransaction();
            await OptimisticLockingUtil.updateMetadataWithRetry(
                Probe, created.id, { $set: { a: 1, version: 2 } }, {}, 'probe', session
            );
            await session.abortTransaction();
        } finally {
            await session.endSession();
        }

        expect(await evuRows()).toBe(0);
    });

    it('transaction commit edilirse EVU satırı yazılır', async () => {
        const created = await Probe.create({ a: 0, version: 1, user: 'u1' });
        const session = await conn.startSession();
        try {
            session.startTransaction();
            await OptimisticLockingUtil.updateWithRetry(
                Probe, created.id, { $set: { a: 1, version: 2 } }, {}, 'probe', session
            );
            await session.commitTransaction();
        } finally {
            await session.endSession();
        }

        const rows = await Outbox.find({ eventType: Subjects.EntityVersionUpdated }).lean();
        expect(rows).toHaveLength(1);
        expect((rows[0] as any).payload).toMatchObject({ entityType: ENTITY_TYPE, entityId: created.id, version: 2 });
    });

    it('session yoksa EVU satırı eskisi gibi doğrudan yazılır', async () => {
        const created = await Probe.create({ a: 0, version: 1, user: 'u1' });

        await OptimisticLockingUtil.updateWithRetry(Probe, created.id, { $set: { a: 1, version: 2 } });

        expect(await evuRows()).toBe(1);
    });
});
