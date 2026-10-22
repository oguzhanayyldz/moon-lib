/**
 * UC-962 — İstek loglarına 7 günlük TTL.
 *
 * Canlıda 16 entegrasyon veritabanında `requestTime_1` indeksi TTL'siz kurulu. Aynı anahtarla ikinci
 * indeks açılamadığı için `ensureIntegrationRequestLogTtlIndex` mevcut indeksi collMod ile dönüştürür.
 * Gerçek mongod üzerinde koşar: varsayılan mongodb-memory-server 6.0.4 (8.x sürümü 7.0 ikilisini
 * başlatamıyor); canlı sürümle (7.0.4) koşmak için REQUEST_LOG_TTL_TEST_MONGO_URI ortam değişkeni verilir.
 */
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
    createIntegrationRequestLogModel,
    ensureIntegrationRequestLogTtlIndex,
    INTEGRATION_REQUEST_LOG_TTL_SECONDS
} from '../integrationRequestLog.schema';

jest.setTimeout(60000);

const COLLECTION = 'integrationrequestlogs';

async function requestTimeIndex(connection: mongoose.Connection) {
    const indexes = await connection.db.collection(COLLECTION).indexes();
    return indexes.filter(index => JSON.stringify(index.key) === JSON.stringify({ requestTime: 1 }));
}

describe('ensureIntegrationRequestLogTtlIndex (UC-962)', () => {
    let mms: MongoMemoryServer | undefined;
    let baseUri: (dbName: string) => string;
    let dbCounter = 0;
    const connections: mongoose.Connection[] = [];

    async function freshConnection(autoIndex: boolean) {
        const connection = await mongoose
            .createConnection(baseUri(`uc962_${Date.now()}_${++dbCounter}`), { autoIndex })
            .asPromise();
        connections.push(connection);
        return connection;
    }

    beforeAll(async () => {
        const externalUri = process.env.REQUEST_LOG_TTL_TEST_MONGO_URI;
        if (externalUri) {
            baseUri = dbName => `${externalUri.replace(/\/$/, '')}/${dbName}`;
            return;
        }
        const server = await MongoMemoryServer.create({ binary: { version: '6.0.4' } });
        mms = server;
        baseUri = dbName => server.getUri(dbName);
    });

    afterAll(async () => {
        await Promise.all(connections.map(connection => connection.dropDatabase().then(() => connection.close())));
        await mms?.stop();
    });

    it('7 gün = 604800 sn', () => {
        expect(INTEGRATION_REQUEST_LOG_TTL_SECONDS).toBe(604800);
    });

    it('canlıdaki TTL\'siz requestTime_1 indeksini collMod ile TTL\'ye çevirir, ikinci çağrı dokunmaz', async () => {
        const connection = await freshConnection(false);
        // Canlıdaki durum: eski şemanın kurduğu düz indeks + mevcut kayıt
        await connection.db.collection(COLLECTION).createIndex({ requestTime: 1 });
        await connection.db.collection(COLLECTION).insertOne({ requestTime: new Date(), marker: 'eski-kayit' });
        createIntegrationRequestLogModel(connection);

        expect(await ensureIntegrationRequestLogTtlIndex(connection)).toBe('modified');
        let [index] = await requestTimeIndex(connection);
        expect(index.name).toBe('requestTime_1');
        expect(index.expireAfterSeconds).toBe(604800);

        expect(await ensureIntegrationRequestLogTtlIndex(connection)).toBe('unchanged');
        const after = await requestTimeIndex(connection);
        expect(after).toHaveLength(1);
        [index] = after;
        expect(index.expireAfterSeconds).toBe(604800);
        // Dönüşüm veriye dokunmaz
        expect(await connection.db.collection(COLLECTION).countDocuments({ marker: 'eski-kayit' })).toBe(1);
    });

    it('farklı süreli TTL indeksini hedef süreye günceller', async () => {
        const connection = await freshConnection(false);
        await connection.db.collection(COLLECTION).createIndex({ requestTime: 1 }, { expireAfterSeconds: 14 * 86400 });
        createIntegrationRequestLogModel(connection);

        expect(await ensureIntegrationRequestLogTtlIndex(connection)).toBe('modified');
        const [index] = await requestTimeIndex(connection);
        expect(index.expireAfterSeconds).toBe(604800);
    });

    it('koleksiyon hiç yoksa TTL\'li indeksi kurar', async () => {
        const connection = await freshConnection(false);
        createIntegrationRequestLogModel(connection);

        expect(await ensureIntegrationRequestLogTtlIndex(connection)).toBe('created');
        const [index] = await requestTimeIndex(connection);
        expect(index.expireAfterSeconds).toBe(604800);
        expect(await ensureIntegrationRequestLogTtlIndex(connection)).toBe('unchanged');
    });

    it('koleksiyon düşürülmüş olsa da (NamespaceNotFound) hata atmaz, indeksi kurar', async () => {
        const connection = await freshConnection(false);
        createIntegrationRequestLogModel(connection);
        // mongoose autoCreate koleksiyonu açmış olabilir: kesin "yok" durumu için düşür
        await connection.model('IntegrationRequestLog').init();
        await connection.db.dropCollection(COLLECTION).catch(() => undefined);

        expect(await ensureIntegrationRequestLogTtlIndex(connection)).toBe('created');
        const [index] = await requestTimeIndex(connection);
        expect(index.expireAfterSeconds).toBe(604800);
    });

    it('bileşik requestTime indekslerine dokunmaz', async () => {
        const connection = await freshConnection(false);
        await connection.db.collection(COLLECTION).createIndex({ requestTime: 1 });
        await connection.db.collection(COLLECTION).createIndex({ userId: 1, requestTime: -1 });
        createIntegrationRequestLogModel(connection);

        await ensureIntegrationRequestLogTtlIndex(connection);
        const compound = (await connection.db.collection(COLLECTION).indexes()).find(index => index.name === 'userId_1_requestTime_-1');
        expect(compound?.expireAfterSeconds).toBeUndefined();
    });

    it('yeni şemanın autoIndex\'i boş veritabanında TTL\'li indeksi kendisi kurar; ensure ile çakışmaz', async () => {
        const connection = await freshConnection(true);
        createIntegrationRequestLogModel(connection);
        await connection.model('IntegrationRequestLog').init();

        const [index] = await requestTimeIndex(connection);
        expect(index.expireAfterSeconds).toBe(604800);
        expect(await ensureIntegrationRequestLogTtlIndex(connection)).toBe('unchanged');
    });
});
