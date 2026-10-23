/**
 * UC-984 madde 9 — sürüm olayı Redis iletim kirası, gerçek Mongo (mongodb-memory-server) + GERÇEK redis-server.
 *
 * Lua betikleri taklitle sınanamaz (taklit betiği yeniden yazmak olur); test kendi redis-server sürecini rastgele
 * bir portta başlatır. `redis-server` yoksa (PATH'te değilse) suite atlanır ve nedenini yazar; REDIS_SERVER_BIN ile yol verilebilir.
 */
import { spawn, spawnSync, ChildProcess } from 'child_process';
import net from 'net';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createClient } from 'redis';
import { EventPublisherJob } from '../jobs/eventPublisher.job';
import { createOutboxModel } from '../models/outbox.schema';
import { EventMetrics } from '../metrics/EventMetrics';
import { Subjects } from '../common/events/subjects';
import { createFakeStan } from '../test/fakes/eventDeliveryHarness';
import { redisWrapper } from '../services/redisWrapper.service';
import { versionInflightKey } from '../utils/versionEventLease.util';

jest.mock('../services/logger.service', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

jest.setTimeout(120000);

const ENV = 'test';
const REDIS_BIN = process.env.REDIS_SERVER_BIN || 'redis-server';
const redisAvailable = spawnSync(REDIS_BIN, ['--version']).status === 0;
if (!redisAvailable) {
    // eslint-disable-next-line no-console
    console.warn(`UC-984 lease tests skipped: "${REDIS_BIN}" not found (set REDIS_SERVER_BIN)`);
}
const describeRedis = redisAvailable ? describe : describe.skip;

type JobInternals = { processVersionEventsAsBulk(): Promise<void> };
type RedisClient = ReturnType<typeof createClient>;

const freePort = () => new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
        const port = (server.address() as net.AddressInfo).port;
        server.close(() => resolve(port));
    });
    server.on('error', reject);
});

const startRedis = async (port: number): Promise<ChildProcess> => {
    const child = spawn(REDIS_BIN, ['--port', String(port), '--save', '', '--appendonly', 'no'], { stdio: 'ignore' });
    for (let i = 0; i < 100; i++) {
        const up = await new Promise<boolean>(resolve => {
            const socket = net.connect(port, '127.0.0.1', () => { socket.end(); resolve(true); });
            socket.on('error', () => resolve(false));
        });
        if (up) return child;
        await new Promise(r => setTimeout(r, 50));
    }
    throw new Error('redis-server did not start');
};

describeRedis('UC-984 — version event Redis lease (real Mongo + real Redis)', () => {
    let mms: MongoMemoryServer;
    let conn: mongoose.Connection;
    let Outbox: ReturnType<typeof createOutboxModel>;
    let redisProcess: ChildProcess;
    let redisPort: number;
    let redis: RedisClient;
    const savedEnv: Record<string, string | undefined> = {};

    const oid = () => new mongoose.Types.ObjectId().toString();
    const event = (entityId: string, version: number) => ({
        entityType: 'product-stock', entityId, service: 'inventory', version, previousVersion: version - 1, userId: 'user-1'
    });
    const insertRaw = async (payload: Record<string, unknown>) => {
        const _id = new mongoose.Types.ObjectId();
        await Outbox.collection.insertOne({
            _id, uniqueCode: oid(), eventType: Subjects.EntityVersionUpdated, payload, status: 'pending',
            retryCount: 0, environment: ENV, priority: 5, creationDate: new Date()
        });
        return _id;
    };
    const row = (id: mongoose.Types.ObjectId) => Outbox.collection.findOne({ _id: id });
    const sentVersions = (stan: ReturnType<typeof createFakeStan>) => stan.publish.mock.calls
        .filter(call => call[0] === Subjects.EntityVersionBulkUpdated)
        .flatMap(call => JSON.parse(call[1] as string).updates as Array<{ entityId: string; version: number }>);
    const metric = async (name: string, labels: Record<string, string> = {}) => {
        const found = (await EventMetrics.getRegistry().getMetricsAsJSON()).find(m => m.name === name);
        return ((found?.values ?? []) as Array<{ value: number; labels: Record<string, string> }>)
            .filter(v => Object.entries(labels).every(([k, val]) => v.labels[k] === val))
            .reduce((sum, v) => sum + v.value, 0);
    };
    const newJob = (stan: ReturnType<typeof createFakeStan>) => new EventPublisherJob(stan.client, conn) as unknown as JobInternals;
    /** Yayını dışarıdan bırakılana kadar bekleten NATS taklidi (iletim süren pod) */
    const gatedStan = () => {
        const stan = createFakeStan();
        let open!: () => void;
        let entered!: () => void;
        const gate = new Promise<void>(resolve => { open = resolve; });
        const inFlight = new Promise<void>(resolve => { entered = resolve; });
        stan.publish.mockImplementation(((_s: string, _d: string, callback: (err?: Error) => void) => {
            entered();
            gate.then(() => callback(undefined));
            return 'guid';
        }) as any);
        return { stan, open: () => open(), inFlight };
    };
    const useRedis = (client: unknown) => { (redisWrapper as any)._client = client; };

    beforeAll(async () => {
        mms = await MongoMemoryServer.create({ binary: { version: '6.0.4' } });
        conn = await mongoose.createConnection(mms.getUri()).asPromise();
        Outbox = createOutboxModel(conn);
        await Outbox.createCollection();
        await Outbox.syncIndexes();
        redisPort = await freePort();
        redisProcess = await startRedis(redisPort);
        redis = createClient({ url: `redis://127.0.0.1:${redisPort}`, socket: { reconnectStrategy: () => 100 } });
        redis.on('error', () => undefined);
        await redis.connect();
    });

    afterAll(async () => {
        useRedis(undefined);
        await redis.disconnect().catch(() => undefined);
        redisProcess?.kill('SIGKILL');
        await conn.close();
        await mms.stop();
    });

    beforeEach(async () => {
        for (const key of ['NODE_ENV', 'SERVICE_NAME', 'VERSION_EVENT_LEASE_MS', 'VERSION_EVENT_REDIS_TIMEOUT_MS']) savedEnv[key] = process.env[key];
        process.env.NODE_ENV = ENV;
        process.env.SERVICE_NAME = 'inventory';
        EventMetrics.reset();
        await Outbox.deleteMany({});
        await redis.flushAll();
        useRedis(redis);
    });

    afterEach(() => {
        for (const [key, value] of Object.entries(savedEnv)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        jest.restoreAllMocks();
    });

    it('two pods draining at once: an entity in flight on pod A is not sent by pod B; its newer version goes after the lease is released', async () => {
        const id = oid();
        const v5 = await insertRaw(event(id, 5));
        const podA = gatedStan();
        const drainA = newJob(podA.stan).processVersionEventsAsBulk();
        await podA.inFlight;

        const v6 = await insertRaw(event(id, 6));
        const other = oid();
        await insertRaw(event(other, 1));
        const podB = createFakeStan();
        const jobB = newJob(podB);
        await jobB.processVersionEventsAsBulk();

        // pod B yalnız iletimde olmayan varlığı gönderdi; A'nın varlığının yeni sürümü pending'de bekliyor
        expect(sentVersions(podB)).toEqual([expect.objectContaining({ entityId: other, version: 1 })]);
        expect((await row(v6))?.status).toBe('pending');
        expect((await row(v6))?.processingStartedAt).toBeUndefined();
        expect((await row(v6))?.retryCount).toBe(0);
        expect(await metric('version_events_duplicate_prevented_total', { reason: 'inflight' })).toBe(1);
        expect(await metric('version_events_inflight')).toBe(0);

        podA.open();
        await drainA;
        expect(sentVersions(podA.stan)).toEqual([expect.objectContaining({ entityId: id, version: 5 })]);
        expect((await row(v5))?.status).toBe('published');
        expect(await redis.exists(versionInflightKey(event(id, 5)))).toBe(0); // sahibi bıraktı

        await jobB.processVersionEventsAsBulk();
        expect(sentVersions(podB)).toEqual([
            expect.objectContaining({ entityId: other, version: 1 }),
            expect.objectContaining({ entityId: id, version: 6 })
        ]);
        expect((await row(v6))?.status).toBe('published');
    });

    it('a deferred row is not re-claimed in the same drain tick (no spinning on the same rows)', async () => {
        process.env.VERSION_EVENT_BATCH_SIZE = '1';
        try {
            const id = oid();
            await redis.set(versionInflightKey(event(id, 1)), '1:other-pod:bulk-x', { PX: 60000 });
            await insertRaw(event(id, 1));
            const free = oid();
            await insertRaw(event(free, 1));
            const stan = createFakeStan();

            await newJob(stan).processVersionEventsAsBulk();

            expect(sentVersions(stan)).toEqual([expect.objectContaining({ entityId: free })]);
            expect(await metric('version_events_duplicate_prevented_total', { reason: 'inflight' })).toBe(1);
        } finally {
            delete process.env.VERSION_EVENT_BATCH_SIZE;
        }
    });

    it('a version already delivered (pod died after publish, row re-queued) is not sent again: superseded as delivered', async () => {
        const id = oid();
        const v5 = await insertRaw(event(id, 5));
        const first = createFakeStan();
        await newJob(first).processVersionEventsAsBulk();
        expect(sentVersions(first)).toHaveLength(1);

        // Yayın oldu ama işaretleme kayboldu → takılı processing kurtarması kaydı pending'e döndürür
        await Outbox.collection.updateOne({ _id: v5 }, { $set: { status: 'pending' }, $unset: { processingStartedAt: '' } });
        const older = await insertRaw(event(id, 4)); // eski pod'un geç yazdığı daha eski sürüm
        const second = createFakeStan();
        await newJob(second).processVersionEventsAsBulk();

        expect(sentVersions(second)).toEqual([]);
        expect(await row(v5)).toEqual(expect.objectContaining({ status: 'superseded', supersededBy: 'delivered:v5' }));
        expect((await row(older))?.status).toBe('superseded');
        expect(await metric('version_events_duplicate_prevented_total', { reason: 'delivered' })).toBe(2);

        // daha yeni sürüm yine gider
        await insertRaw(event(id, 6));
        await newJob(second).processVersionEventsAsBulk();
        expect(sentVersions(second)).toEqual([expect.objectContaining({ version: 6 })]);
    });

    it('pod dies mid-flight: its lease expires on its own and the event is sent afterwards', async () => {
        const id = oid();
        await redis.set(versionInflightKey(event(id, 3)), '3:dead-pod:bulk-1', { PX: 300 });
        const v3 = await insertRaw(event(id, 3));
        const stan = createFakeStan();
        const job = newJob(stan);

        await job.processVersionEventsAsBulk();
        expect(sentVersions(stan)).toEqual([]);
        expect((await row(v3))?.status).toBe('pending');

        await new Promise(r => setTimeout(r, 400));
        await job.processVersionEventsAsBulk();
        expect(sentVersions(stan)).toEqual([expect.objectContaining({ entityId: id, version: 3 })]);
        expect((await row(v3))?.status).toBe('published');
    });

    it('a lease that expired before the publish finished is counted and not deleted from its new owner', async () => {
        process.env.VERSION_EVENT_LEASE_MS = '100';
        const id = oid();
        await insertRaw(event(id, 1));
        const pod = gatedStan();
        const drain = newJob(pod.stan).processVersionEventsAsBulk();
        await pod.inFlight;
        await new Promise(r => setTimeout(r, 200));
        await redis.set(versionInflightKey(event(id, 1)), '2:new-owner:bulk-2', { PX: 60000 });
        pod.open();
        await drain;

        expect(await metric('version_events_lease_expired_total')).toBe(1);
        expect(await redis.get(versionInflightKey(event(id, 1)))).toBe('2:new-owner:bulk-2');
    });

    it('a whole batch takes three Redis round trips regardless of size (acquire, mark delivered, release)', async () => {
        for (let i = 0; i < 50; i++) await insertRaw(event(oid(), 1));
        const evalSpy = jest.spyOn(redis, 'eval');
        const stan = createFakeStan();

        await newJob(stan).processVersionEventsAsBulk();

        expect(sentVersions(stan)).toHaveLength(50);
        expect(evalSpy).toHaveBeenCalledTimes(3);
        // anahtarlar ortama göre ayrık (paylaşımlı dev/prod Redis)
        const keys = await redis.keys('*');
        expect(keys.length).toBe(50);
        keys.forEach(key => expect(key.startsWith(`${ENV}:vsync:latest:inventory:product-stock:`)).toBe(true));
    });

    it('Redis not connected: publishing continues with the Mongo claim only, nothing is lost', async () => {
        useRedis(undefined);
        const ids = [await insertRaw(event(oid(), 1)), await insertRaw(event(oid(), 2))];
        const stan = createFakeStan();

        await newJob(stan).processVersionEventsAsBulk();

        expect(sentVersions(stan)).toHaveLength(2);
        for (const id of ids) expect((await row(id))?.status).toBe('published');
        expect(await metric('version_events_lease_unavailable_total')).toBeGreaterThan(0);
    });

    it('Redis hanging: the lease call times out and publishing continues', async () => {
        process.env.VERSION_EVENT_REDIS_TIMEOUT_MS = '150';
        useRedis({ eval: () => new Promise(() => undefined) });
        const id = await insertRaw(event(oid(), 1));
        const stan = createFakeStan();
        const started = Date.now();

        await newJob(stan).processVersionEventsAsBulk();

        expect(Date.now() - started).toBeLessThan(5000);
        expect(sentVersions(stan)).toHaveLength(1);
        expect((await row(id))?.status).toBe('published');
        expect(await metric('version_events_lease_unavailable_total')).toBeGreaterThanOrEqual(1);
    });

    it('redis-server stopped mid-run: publishing continues, nothing is lost (runs last: stops the server)', async () => {
        process.env.VERSION_EVENT_REDIS_TIMEOUT_MS = '300';
        redisProcess.kill('SIGKILL');
        await new Promise(r => setTimeout(r, 200));
        const ids = [await insertRaw(event(oid(), 1)), await insertRaw(event(oid(), 1))];
        const stan = createFakeStan();

        await newJob(stan).processVersionEventsAsBulk();

        expect(sentVersions(stan)).toHaveLength(2);
        for (const id of ids) expect((await row(id))?.status).toBe('published');
        expect(await metric('version_events_lease_unavailable_total')).toBeGreaterThan(0);
    });
});
