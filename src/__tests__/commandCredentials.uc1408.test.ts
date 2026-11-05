/**
 * UC-1408 (Y-1) — integration:command yükünde düz credential ve User PII kalmaz.
 *
 * - Outbox kaydı (gerçek Mongo, mongodb-memory-server) mühürlü yazılır; `user` yalnız kimliktir.
 * - IntegrationCommandPublisher STAN'a mühürlü yayar (outbox'tan gelen ve eski düz kayıt replay'i).
 * - BaseIntegration.setup hem mühürlü (yeni) hem düz (eski, 180 gün replay) şekli işler.
 * - Bayrak kapalıyken (faz 1) değerler düz kalır, yalnız `user` kimliğe iner.
 * Değerler hiçbir assert mesajına basılmaz: karşılaştırmalar boolean / sayımla yapılır.
 */
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createOutboxModel } from '../models/outbox.schema';
import { Subjects } from '../common/events/subjects';
import { EncryptionUtil } from '../utils/encryption.util';
import {
    sealCommandCredentials,
    unsealCommandCredentials,
    sealIntegrationCommandData,
    toCommandUserId,
    SEAL_COMMAND_CREDENTIALS_ENV
} from '../utils/commandCredentials.util';
import { IntegrationCommandPublisher } from '../events/publishers/integrationCommand.publisher';
import { BaseIntegration } from '../common/core/base-integration';
import { EventPublisherJob } from '../jobs/eventPublisher.job';
import { createFakeStan } from '../test/fakes/eventDeliveryHarness';

jest.mock('../services/logger.service', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

jest.setTimeout(120000);

const TEST_KEY = 'a'.repeat(64);
// Sahte fixture değerleri (gerçek sır değil)
const FIXTURE_SECRETS = { apiKey: 'fixture-key-1408', apiSecret: 'fixture-secret-1408', storeName: 'fixture-store' };
const USER_ID = new mongoose.Types.ObjectId().toHexString();
const FULL_USER = { id: USER_ID, _id: USER_ID, name: 'Ada', surname: 'Fixture', email: 'ada@fixture.invalid' };

const oldShapeCredentials = () => ({
    ...FIXTURE_SECRETS,
    testMode: false,
    shipment_settings: { enabled: true },
    integration_active: true,
    user: { ...FULL_USER },
    platform: 'pazarama'
});

/** Bir nesnede düz fixture değeri ya da PII kaç kez geçiyor (değer basmadan). */
const countPlain = (obj: unknown): number => {
    const json = JSON.stringify(obj);
    const needles = [...Object.values(FIXTURE_SECRETS), FULL_USER.email, FULL_USER.name, FULL_USER.surname];
    return needles.reduce((n, needle) => n + (json.includes(needle) ? 1 : 0), 0);
};

class FixtureIntegration extends BaseIntegration {
    protected getDefaultCredentials() { return { integration_active: false }; }
    protected validatePlatformCredentials(): void {
        if (!this.credentials.apiKey || !this.credentials.apiSecret) throw new Error('apiKey/apiSecret required');
    }
    protected async connect(): Promise<void> { /* ağ yok */ }
}

describe('UC-1408 — integration:command credential mühürleme', () => {
    let prevKey: string | undefined;
    let prevFlag: string | undefined;

    beforeEach(() => {
        prevKey = process.env.ENCRYPTION_KEY;
        prevFlag = process.env[SEAL_COMMAND_CREDENTIALS_ENV];
        process.env.ENCRYPTION_KEY = TEST_KEY;
        process.env[SEAL_COMMAND_CREDENTIALS_ENV] = 'true';
    });
    afterEach(() => {
        if (prevKey === undefined) delete process.env.ENCRYPTION_KEY; else process.env.ENCRYPTION_KEY = prevKey;
        if (prevFlag === undefined) delete process.env[SEAL_COMMAND_CREDENTIALS_ENV]; else process.env[SEAL_COMMAND_CREDENTIALS_ENV] = prevFlag;
    });

    describe('toCommandUserId', () => {
        it('tam User belgesini, {_id}, ObjectId ve string kimliği yalnız kimliğe indirir', () => {
            expect(toCommandUserId({ ...FULL_USER })).toBe(USER_ID);
            expect(toCommandUserId({ _id: new mongoose.Types.ObjectId(USER_ID), email: 'x@y.invalid' })).toBe(USER_ID);
            expect(toCommandUserId(new mongoose.Types.ObjectId(USER_ID))).toBe(USER_ID);
            expect(toCommandUserId(USER_ID)).toBe(USER_ID);
            expect(toCommandUserId(undefined)).toBeUndefined();
        });
        it('mongoose belgesinde de yalnız kimlik kalır', () => {
            const M = mongoose.model('Uc1408User', new mongoose.Schema({ name: String, email: String }));
            const doc = new M({ _id: new mongoose.Types.ObjectId(USER_ID), name: 'Ada', email: 'ada@fixture.invalid' });
            expect(toCommandUserId(doc)).toBe(USER_ID);
        });
        it('kimliksiz nesne PII taşımamak için düşer', () => {
            expect(toCommandUserId({ email: 'ada@fixture.invalid' })).toBeUndefined();
        });
    });

    describe('sealCommandCredentials / unsealCommandCredentials', () => {
        it('gizli string değerleri mühürler; yönlendirme anahtarları ve string olmayanlar düz kalır', () => {
            const input = oldShapeCredentials();
            const sealed = sealCommandCredentials(input);

            expect(countPlain(sealed)).toBe(0);
            expect(EncryptionUtil.isEncrypted(sealed.apiKey)).toBe(true);
            expect(EncryptionUtil.isEncrypted(sealed.apiSecret)).toBe(true);
            expect(EncryptionUtil.isEncrypted(sealed.storeName)).toBe(true);
            expect(sealed.user).toBe(USER_ID);
            expect(sealed.platform).toBe('pazarama');
            expect(sealed.integration_active).toBe(true);
            expect(sealed.testMode).toBe(false);
            expect(sealed.shipment_settings).toEqual({ enabled: true });
        });

        it('girdiyi değiştirmez ve idempotenttir', () => {
            const input = oldShapeCredentials();
            const before = JSON.stringify(input);
            const once = sealCommandCredentials(input);
            const twice = sealCommandCredentials(once);
            expect(JSON.stringify(input)).toBe(before);
            expect(twice.apiKey).toBe(once.apiKey);
        });

        it('mühür açılınca özgün değerler döner; düz değerler aynen geçer', () => {
            const sealed = sealCommandCredentials(oldShapeCredentials());
            const opened = unsealCommandCredentials(sealed);
            expect(opened.apiKey === FIXTURE_SECRETS.apiKey).toBe(true);
            expect(opened.apiSecret === FIXTURE_SECRETS.apiSecret).toBe(true);
            expect(opened.storeName === FIXTURE_SECRETS.storeName).toBe(true);

            const plain = { apiKey: FIXTURE_SECRETS.apiKey, user: USER_ID };
            expect(unsealCommandCredentials(plain)).toBe(plain);
        });

        it('çözülemeyen değerde alan düşer, öteki alanlar çalışır; warn yalnız anahtar adını içerir', () => {
            const { logger } = require('../services/logger.service');
            (logger.warn as jest.Mock).mockClear();
            const sealed = sealCommandCredentials(oldShapeCredentials());
            const sealedApiKey = sealed.apiKey;
            // yalnız apiKey bozuk (anahtar uyuşmazlığı simülasyonu): geri kalanı geçerli kalsın
            const mixed = { ...sealed, apiKey: sealedApiKey.replace(/.$/, c => (c === '0' ? '1' : '0')) };
            const opened = unsealCommandCredentials(mixed);
            expect('apiKey' in opened).toBe(false);
            expect(opened.apiSecret === FIXTURE_SECRETS.apiSecret).toBe(true);
            expect(opened.storeName === FIXTURE_SECRETS.storeName).toBe(true);
            const warnings = (logger.warn as jest.Mock).mock.calls.map(c => String(c[0]));
            expect(warnings.length).toBe(1);
            expect(warnings[0]).toContain("'apiKey'");
            expect(warnings[0].includes(sealedApiKey)).toBe(false);
        });

        it('faz 1 (bayrak kapalı): değerler düz kalır, yalnız user kimliğe iner', () => {
            delete process.env[SEAL_COMMAND_CREDENTIALS_ENV];
            const sealed = sealCommandCredentials(oldShapeCredentials());
            expect(sealed.apiKey === FIXTURE_SECRETS.apiKey).toBe(true);
            expect(sealed.user).toBe(USER_ID);
            expect(JSON.stringify(sealed).includes(FULL_USER.email)).toBe(false);
        });

        it('ENCRYPTION_KEY yoksa bayrak açık olsa da mühürlemez (yayıncı çökmez)', () => {
            delete process.env.ENCRYPTION_KEY;
            const sealed = sealCommandCredentials(oldShapeCredentials());
            expect(sealed.apiKey === FIXTURE_SECRETS.apiKey).toBe(true);
        });

        it('sealIntegrationCommandData credentials yoksa aynı nesneyi döner', () => {
            const data = { requestId: 'r', user: USER_ID, command: 'SYNC_ORDERS' };
            expect(sealIntegrationCommandData(data)).toBe(data);
        });
    });

    describe('natsWrapper.request (B1) — istek-yanıt yolu', () => {
        const makeWrapper = () => {
            const published: Array<{ subject: string; body: string }> = [];
            const nc = { publish: jest.fn(), subscribe: jest.fn(() => 1), unsubscribe: jest.fn() };
            const client = { nc, publish: (subject: string, body: string) => { published.push({ subject, body }); } };
            const { NatsWrapper } = require('../services/natsWrapper.service');
            const wrapper = new NatsWrapper();
            (wrapper as any)._client = client;
            Object.defineProperty(wrapper, 'client', { get: () => client });
            return { wrapper, published };
        };

        it('bayrak açık: STAN\'a yazılan istekte düz fixture değeri/PII = 0; replyTo korunur', () => {
            const { wrapper, published } = makeWrapper();
            const data = { requestId: 'r1', payload: { credentials: oldShapeCredentials(), orderId: 'o1' } };
            const before = JSON.stringify(data);
            wrapper.request('shipment:request', data, { timeout: 50 }).catch(() => undefined);
            expect(published.length).toBe(1);
            const body = JSON.parse(published[0].body);
            expect(countPlain(body)).toBe(0);
            expect(EncryptionUtil.isEncrypted(body.payload.credentials.apiKey)).toBe(true);
            expect(body.payload.credentials.user).toBe(USER_ID);
            expect(body.replyTo.startsWith('_INBOX.')).toBe(true);
            expect(body.payload.orderId).toBe('o1');
            expect(JSON.stringify(data)).toBe(before); // çağıranın nesnesi değişmez
        });

        it('credentials taşımayan istek değişmeden geçer', () => {
            const { wrapper, published } = makeWrapper();
            wrapper.request('orders:label', { orderId: 'o1', payload: { foo: 'bar' } }, { timeout: 50 }).catch(() => undefined);
            const body = JSON.parse(published[0].body);
            expect(body.orderId).toBe('o1');
            expect(body.payload).toEqual({ foo: 'bar' });
        });
    });

    describe('BaseIntegration.setup — yeni ve eski yük şekli', () => {
        it('yeni (mühürlü) yükü çözer', async () => {
            const sealed = sealCommandCredentials(oldShapeCredentials());
            const integration = await new FixtureIntegration().setup(USER_ID, 'pazarama', { ...sealed, integrationId: 'int-1' });
            const creds = integration.getCredentials();
            expect(creds.apiKey === FIXTURE_SECRETS.apiKey).toBe(true);
            expect(creds.apiSecret === FIXTURE_SECRETS.apiSecret).toBe(true);
            expect(creds.user).toBe(USER_ID);
            expect(creds.integrationId).toBe('int-1');
        });

        it('eski (düz + tam User) yükü işler; user argümanla ezilir', async () => {
            const integration = await new FixtureIntegration().setup(USER_ID, 'pazarama', oldShapeCredentials());
            const creds = integration.getCredentials();
            expect(creds.apiKey === FIXTURE_SECRETS.apiKey).toBe(true);
            expect(creds.user).toBe(USER_ID);
        });
    });

    describe('Outbox + yayıncı (gerçek Mongo)', () => {
        let mms: MongoMemoryServer;
        let conn: mongoose.Connection;
        let Outbox: ReturnType<typeof createOutboxModel>;
        let prevEnv: string | undefined;

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
            prevEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'test';
            await Outbox.deleteMany({});
        });
        afterEach(() => { process.env.NODE_ENV = prevEnv; });

        const commandPayload = () => ({
            requestId: 'req-1408',
            user: USER_ID,
            platform: 'pazarama',
            command: 'SYNC_ORDERS',
            params: {},
            payload: { credentials: oldShapeCredentials(), integrationId: 'int-1' }
        });

        it('save: diskteki kayıtta düz credential = 0, User PII = 0, user yalnız kimlik', async () => {
            await Outbox.build({ eventType: Subjects.IntegrationCommand, payload: commandPayload() as any, status: 'pending' }).save();
            const raw = await conn.collection('outboxes').findOne({ eventType: Subjects.IntegrationCommand });
            expect(countPlain(raw)).toBe(0);
            expect(raw!.payload.payload.credentials.user).toBe(USER_ID);
            expect(raw!.userId).toBe(USER_ID);
        });

        it('insertMany: toplu yazımda da mühürlenir', async () => {
            await Outbox.insertMany([{ eventType: Subjects.IntegrationCommand, payload: commandPayload(), status: 'pending' }]);
            const raw = await conn.collection('outboxes').findOne({ eventType: Subjects.IntegrationCommand });
            expect(countPlain(raw)).toBe(0);
        });

        it('başka olay tiplerinin payload\'ına dokunmaz', async () => {
            const payload = { id: 'p1', credentials: { apiKey: FIXTURE_SECRETS.apiKey } };
            await Outbox.build({ eventType: Subjects.ProductUpdated, payload: payload as any, status: 'pending' }).save();
            const raw = await conn.collection('outboxes').findOne({ eventType: Subjects.ProductUpdated });
            expect(raw!.payload.credentials.apiKey === FIXTURE_SECRETS.apiKey).toBe(true);
        });

        it('yayıncı STAN\'a mühürlü yayar; tüketici setup ile çözer (uçtan uca)', async () => {
            const nats = createFakeStan();
            const data = commandPayload();
            const before = JSON.stringify(data);
            await new IntegrationCommandPublisher(nats.client).publish(data as any);

            expect(JSON.stringify(data)).toBe(before); // girdi değişmedi
            const wire = JSON.parse(nats.publish.mock.calls[0][1] as string);
            expect(countPlain(wire)).toBe(0);
            expect(wire.payload.credentials.user).toBe(USER_ID);

            const integration = await new FixtureIntegration().setup(wire.user, wire.platform, {
                ...(wire.payload?.credentials || {}),
                integrationId: wire.payload?.integrationId
            });
            expect(integration.getCredentials().apiKey === FIXTURE_SECRETS.apiKey).toBe(true);
        });

        it('replay: eski düz outbox kaydı mühürlü yayılır, kaydın kendisine dokunulmaz (karar B)', async () => {
            // Ham ekleme: kanca çalışmaz → eski (UC-1408 öncesi) şekilli kayıt
            const _id = new mongoose.Types.ObjectId();
            await conn.collection('outboxes').insertOne({
                _id, uniqueCode: _id.toHexString(), eventType: Subjects.IntegrationCommand,
                payload: commandPayload(), status: 'pending', environment: 'test', retryCount: 0,
                priority: 1, userId: USER_ID, creationDate: new Date(), updatedOn: new Date()
            });
            const rawBefore = await conn.collection('outboxes').findOne({ _id });
            expect(countPlain(rawBefore)).toBeGreaterThan(0);

            const nats = createFakeStan();
            const job = new EventPublisherJob(nats.client, conn) as unknown as { publishEvent(e: any): Promise<void> };
            const event = await Outbox.findById(_id);
            await job.publishEvent(event);

            const wire = JSON.parse(nats.publish.mock.calls[0][1] as string);
            expect(countPlain(wire)).toBe(0);
            expect(wire.command).toBe('SYNC_ORDERS');

            const rawAfter = await conn.collection('outboxes').findOne({ _id });
            expect(JSON.stringify(rawAfter!.payload)).toBe(JSON.stringify(rawBefore!.payload));
        });
    });
});
