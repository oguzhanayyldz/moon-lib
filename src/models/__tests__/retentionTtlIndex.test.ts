/**
 * UC-1056 — outbox/deadletters saklama TTL'i (KVKK).
 *
 * Gerçek mongod üzerinde koşar (kısmi TTL + $in filtresi sunucu davranışıdır): varsayılan mongodb-memory-server
 * 6.0.4; canlı sürümle (7.0.4) koşmak için REQUEST_LOG_TTL_TEST_MONGO_URI ortam değişkeni verilir.
 */
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createOutboxModel } from '../outbox.schema';
import { createDeadLetterModel } from '../deadLetter.schema';
import {
    DEAD_LETTER_RETENTION_TTL_INDEX,
    ensureDeadLetterRetentionTtlIndex,
    ensureOutboxRetentionTtlIndex,
    ensureRetentionTtlIndexes,
    OUTBOX_RETENTION_TTL_INDEX,
    parseRetentionDays
} from '../retentionTtlIndex';

jest.setTimeout(60000);

const DAY = 24 * 60 * 60;

async function namedIndex(connection: mongoose.Connection, collection: string, name: string) {
    const indexes = await connection.db.collection(collection).indexes();
    return indexes.find(index => index.name === name);
}

describe('parseRetentionDays (UC-1056)', () => {
    it('tanımsız ya da boş değer kapalıdır', () => {
        expect(parseRetentionDays(undefined, 'X')).toBeUndefined();
        expect(parseRetentionDays('  ', 'X')).toBeUndefined();
    });

    it('pozitif tam sayıyı gün olarak okur', () => {
        expect(parseRetentionDays('30', 'X')).toBe(30);
    });

    it.each(['0', '-5', '7.5', '30d', 'abc'])('geçersiz değer "%s" sessizce kapalı sayılmaz, hata atar', raw => {
        expect(() => parseRetentionDays(raw, 'OUTBOX_RETENTION_DAYS')).toThrow('OUTBOX_RETENTION_DAYS');
    });
});

describe('ensure*RetentionTtlIndex (UC-1056)', () => {
    let mms: MongoMemoryServer | undefined;
    let baseUri: (dbName: string) => string;
    let dbCounter = 0;
    const connections: mongoose.Connection[] = [];

    async function freshConnection() {
        // autoIndex kapalı: şemanın kendi indeksleri testi bekletmesin; TTL indeksi şemada değil, ensure kurar
        const connection = await mongoose
            .createConnection(baseUri(`uc1056_${Date.now()}_${++dbCounter}`), { autoIndex: false })
            .asPromise();
        connections.push(connection);
        createOutboxModel(connection);
        createDeadLetterModel(connection);
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

    it('gün verilmezse hiçbir indeks kurmaz', async () => {
        const connection = await freshConnection();
        await connection.db.collection('outboxes').insertOne({ status: 'published', creationDate: new Date() });

        expect(await ensureOutboxRetentionTtlIndex(connection, undefined)).toBe('disabled');
        expect(await ensureDeadLetterRetentionTtlIndex(connection, undefined)).toBe('disabled');
        expect(await namedIndex(connection, 'outboxes', OUTBOX_RETENTION_TTL_INDEX)).toBeUndefined();
    });

    it('outbox: creationDate üzerinde yalnız biten durumları kapsayan kısmi TTL kurar, ikinci çağrı dokunmaz', async () => {
        const connection = await freshConnection();

        expect(await ensureOutboxRetentionTtlIndex(connection, 30)).toBe('created');
        const index = await namedIndex(connection, 'outboxes', OUTBOX_RETENTION_TTL_INDEX);
        expect(index?.key).toEqual({ creationDate: 1 });
        expect(index?.expireAfterSeconds).toBe(30 * DAY);
        expect(index?.partialFilterExpression).toEqual({
            status: { $in: ['published', 'completed', 'superseded'] }
        });

        expect(await ensureOutboxRetentionTtlIndex(connection, 30)).toBe('unchanged');
    });

    it('outbox: gün değişince collMod ile süreyi günceller, ikinci indeks açmaz', async () => {
        const connection = await freshConnection();
        expect(await ensureOutboxRetentionTtlIndex(connection, 180)).toBe('created');

        expect(await ensureOutboxRetentionTtlIndex(connection, 30)).toBe('modified');
        const indexes = (await connection.db.collection('outboxes').indexes())
            .filter(index => index.name === OUTBOX_RETENTION_TTL_INDEX);
        expect(indexes).toHaveLength(1);
        expect(indexes[0].expireAfterSeconds).toBe(30 * DAY);
    });

    it('aynı adla farklı kısmi filtreli indeks varsa yeniden kurar', async () => {
        const connection = await freshConnection();
        await connection.db.collection('outboxes').createIndex(
            { creationDate: 1 },
            { name: OUTBOX_RETENTION_TTL_INDEX, expireAfterSeconds: 30 * DAY, partialFilterExpression: { status: 'published' } }
        );

        expect(await ensureOutboxRetentionTtlIndex(connection, 30)).toBe('modified');
        const index = await namedIndex(connection, 'outboxes', OUTBOX_RETENTION_TTL_INDEX);
        expect(index?.partialFilterExpression).toEqual({
            status: { $in: ['published', 'completed', 'superseded'] }
        });
    });

    it('mevcut outbox indekslerine dokunmaz', async () => {
        const connection = await freshConnection();
        await connection.model('Outbox').syncIndexes();
        const before = (await connection.db.collection('outboxes').indexes()).map(index => index.name).sort();

        await ensureOutboxRetentionTtlIndex(connection, 30);
        const after = (await connection.db.collection('outboxes').indexes()).map(index => index.name).sort();
        expect(after).toEqual([...before, OUTBOX_RETENTION_TTL_INDEX].sort());
    });

    it('deadletters: timestamp üzerinde completed/failed/pending/archived/queued kapsayan kısmi TTL kurar', async () => {
        const connection = await freshConnection();

        expect(await ensureDeadLetterRetentionTtlIndex(connection, 30)).toBe('created');
        const index = await namedIndex(connection, 'deadletters', DEAD_LETTER_RETENTION_TTL_INDEX);
        expect(index?.key).toEqual({ timestamp: 1 });
        expect(index?.expireAfterSeconds).toBe(30 * DAY);
        expect(index?.partialFilterExpression).toEqual({
            status: { $in: ['completed', 'failed', 'pending', 'archived', 'queued'] }
        });
    });

    it('deadletters: gün değişince collMod ile süreyi günceller, ikinci indeks açmaz', async () => {
        const connection = await freshConnection();
        expect(await ensureDeadLetterRetentionTtlIndex(connection, 90)).toBe('created');

        expect(await ensureDeadLetterRetentionTtlIndex(connection, 30)).toBe('modified');
        const indexes = (await connection.db.collection('deadletters').indexes())
            .filter(index => index.name === DEAD_LETTER_RETENTION_TTL_INDEX);
        expect(indexes).toHaveLength(1);
        expect(indexes[0].expireAfterSeconds).toBe(30 * DAY);
        expect(indexes[0].partialFilterExpression).toEqual({
            status: { $in: ['completed', 'failed', 'pending', 'archived', 'queued'] }
        });
    });

    it('deadletters: eski 3 durumlu filtreli indeksi drop+create ile 5 durumluya çevirir', async () => {
        const connection = await freshConnection();
        await connection.db.collection('deadletters').createIndex(
            { timestamp: 1 },
            {
                name: DEAD_LETTER_RETENTION_TTL_INDEX,
                expireAfterSeconds: 30 * DAY,
                partialFilterExpression: { status: { $in: ['completed', 'failed', 'pending'] } }
            }
        );

        // Gün aynı, yalnız liste değişti: collMod filtre değiştiremez, 'unchanged' dönmemeli
        expect(await ensureDeadLetterRetentionTtlIndex(connection, 30)).toBe('modified');
        const indexes = (await connection.db.collection('deadletters').indexes())
            .filter(index => index.name === DEAD_LETTER_RETENTION_TTL_INDEX);
        expect(indexes).toHaveLength(1);
        expect(indexes[0].partialFilterExpression).toEqual({
            status: { $in: ['completed', 'failed', 'pending', 'archived', 'queued'] }
        });
        expect(indexes[0].expireAfterSeconds).toBe(30 * DAY);
    });

    it('TTL monitörü yalnız biten durumları siler; bekleyen/işlenen/başarısız ve DLQ işlemci claim kaydı kalır (gerçek silme)', async () => {
        // Varsayılan TTL monitörü 60 sn'de bir koşar: ayrı mongod'da 1 sn'ye çekilir
        const ttlServer = await MongoMemoryServer.create({
            binary: { version: '6.0.4' },
            instance: { args: ['--setParameter', 'ttlMonitorSleepSecs=1'] }
        });
        const connection = await mongoose.createConnection(ttlServer.getUri('uc1056_ttl'), { autoIndex: false }).asPromise();
        try {
            createOutboxModel(connection);
            createDeadLetterModel(connection);
            const old = new Date(Date.now() - 400 * DAY * 1000);
            const fresh = new Date();
            const outboxStatuses = ['published', 'completed', 'superseded', 'pending', 'processing', 'failed'];
            await connection.db.collection('outboxes').insertMany([
                ...outboxStatuses.map(status => ({ status, creationDate: old })),
                { status: 'published', creationDate: fresh }
            ]);
            const dlqStatuses = ['completed', 'failed', 'pending', 'archived', 'queued', 'replaying', 'processing'];
            await connection.db.collection('deadletters').insertMany(dlqStatuses.map(status => ({ status, timestamp: old })));

            await ensureOutboxRetentionTtlIndex(connection, 30);
            await ensureDeadLetterRetentionTtlIndex(connection, 30);

            const remaining = async (collection: string) =>
                (await connection.db.collection(collection).find({}, { projection: { status: 1, _id: 0 } }).toArray())
                    .map(doc => doc.status).sort();
            const deadline = Date.now() + 20000;
            while (Date.now() < deadline && (await connection.db.collection('outboxes').countDocuments()) > 4) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            await new Promise(resolve => setTimeout(resolve, 2500));

            // 30 günden yeni published kalır
            expect(await remaining('outboxes')).toEqual(['failed', 'pending', 'processing', 'published']);
            expect(await connection.db.collection('outboxes').countDocuments({ status: 'published', creationDate: fresh })).toBe(1);
            // archived ve queued da silinir; yalnız işlemci claim'i (replaying/processing) kalır
            expect(await remaining('deadletters')).toEqual(['processing', 'replaying']);
        } finally {
            await connection.close();
            await ttlServer.stop();
        }
    });

    it('ensureRetentionTtlIndexes: geçersiz env değeri servisi durdurmaz, uyarı loglar', async () => {
        const connection = await freshConnection();
        const previous = { outbox: process.env.OUTBOX_RETENTION_DAYS, dlq: process.env.DEADLETTER_RETENTION_DAYS };
        process.env.OUTBOX_RETENTION_DAYS = '30d';
        process.env.DEADLETTER_RETENTION_DAYS = '30';
        const info = jest.fn();
        const warn = jest.fn();
        try {
            expect(() => ensureRetentionTtlIndexes(connection, { info, warn })).not.toThrow();
            await new Promise(resolve => setTimeout(resolve, 500));
        } finally {
            process.env.OUTBOX_RETENTION_DAYS = previous.outbox;
            process.env.DEADLETTER_RETENTION_DAYS = previous.dlq;
            if (previous.outbox === undefined) delete process.env.OUTBOX_RETENTION_DAYS;
            if (previous.dlq === undefined) delete process.env.DEADLETTER_RETENTION_DAYS;
        }

        expect(warn).toHaveBeenCalledWith('Outbox retention TTL index could not be ensured', {
            error: expect.stringContaining('OUTBOX_RETENTION_DAYS')
        });
        expect(info).toHaveBeenCalledWith('DeadLetter retention TTL index: created');
        expect(await namedIndex(connection, 'outboxes', OUTBOX_RETENTION_TTL_INDEX)).toBeUndefined();
    });
});
