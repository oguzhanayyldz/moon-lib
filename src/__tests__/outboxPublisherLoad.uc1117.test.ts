/**
 * UC-1117 — yayıncının yük altındaki maliyeti.
 *
 * (c) Kullanıcı başı outbox sorgusu tek sorgu + `sort({priority, creationDate})` idi. Sürüm olayı birikiminde
 *     planlayıcı eventType'lı indeksi seçip önbelleğe alıyor; birikim iş olayına dönünce plan değişmiyor ve sorgu
 *     her geçişte binlerce kaydı okuyup bellekte sıralıyordu. Artık iki hint'li sorgu: priority 1-4 (ve priority'siz
 *     eski kayıtlar) kendi indeksiyle, yoksa priority 5 eventType'lı indeksle. Hint reddedilirse hint'siz sorgulanır.
 * (b1) Olay ve parti başına info satırları debug'a indi; tur başına tek info özet kalır, hata/uyarı aynı.
 * Mongo ve NATS #648 bellek içi taklitleriyle değiştirildi; job kodu olduğu gibi koşar.
 */
import { EventPublisherJob } from '../jobs/eventPublisher.job';
import { Subjects } from '../common';
import { logger } from '../services/logger.service';
import { createFakeStan, createOutboxStore, useFakeClock } from '../test/fakes/eventDeliveryHarness';

jest.mock('../services/logger.service', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    }
}));

const PRIORITY_INDEX = { status: 1, environment: 1, userId: 1, priority: 1, creationDate: 1 };
const EVENT_TYPE_INDEX = { status: 1, environment: 1, retryCount: 1, userId: 1, eventType: 1 };

type JobInternals = {
    processEvents(): Promise<void>;
    processEventsOnce(): Promise<number>;
    processVersionEventsAsBulk(): Promise<void>;
};

function stockPayload(id: string) {
    return { id, uuid: `uuid-${id}`, user: 'user-1', version: 1, product: 'product-1', quantity: 3 };
}

function notificationPayload(id: string) {
    return { id, userId: 'user-1', type: 'system', category: 'stock' };
}

function versionPayload(entityId: string) {
    return { entityType: 'ProductStock', entityId, service: 'inventory', version: 2, previousVersion: 1, timestamp: new Date(), userId: 'user-1' };
}

const infoMessages = () => (logger.info as jest.Mock).mock.calls.map(([message]) => String(message));
const debugMessages = () => (logger.debug as jest.Mock).mock.calls.map(([message]) => String(message));

describe('UC-1117 — EventPublisherJob kullanıcı başı outbox sorgusu', () => {
    let nats: ReturnType<typeof createFakeStan>;
    let outbox: ReturnType<typeof createOutboxStore>;

    const newJob = () => new EventPublisherJob(nats.client, outbox.connection) as unknown as JobInternals;
    const userHints = () => outbox.collection.hints.filter(h => h.filter.userId === 'user-1').map(h => h.index);

    beforeEach(() => {
        jest.clearAllMocks();
        nats = createFakeStan();
        outbox = createOutboxStore();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('UC-1117: iş olayları priority indeksine hint\'li tek sorguyla alınır, priority 5 sorgusu koşmaz', async () => {
        const records = Array.from({ length: 30 }, (_, i) => outbox.seed(Subjects.ProductStockUpdated, stockPayload(`s-${i}`)));

        const published = await newJob().processEventsOnce();

        expect(published).toBe(30);
        expect(records.every(r => r.status === 'published')).toBe(true);
        expect(userHints()).toEqual([PRIORITY_INDEX]);
    });

    it('UC-1117: bekleyen sürüm olayları normal geçişte yayınlanmaz, yalnız priority 5 iş olayı ikinci sorguyla alınır', async () => {
        const versions = Array.from({ length: 40 }, (_, i) => outbox.seed(Subjects.EntityVersionUpdated, versionPayload(`ps-${i}`)));
        const notification = outbox.seed(Subjects.NotificationCreated, notificationPayload('n-1'));

        const published = await newJob().processEventsOnce();

        expect(published).toBe(1);
        expect(notification.status).toBe('published');
        expect(versions.every(v => v.status === 'pending')).toBe(true);
        expect(userHints()).toEqual([PRIORITY_INDEX, EVENT_TYPE_INDEX]);
    });

    it('priority 1-4 olayı varken priority 5 olayı aynı geçişte yayınlanmaz (sıra korunur)', async () => {
        const stock = outbox.seed(Subjects.ProductStockUpdated, stockPayload('s-1'));
        const notification = outbox.seed(Subjects.NotificationCreated, notificationPayload('n-1'));

        await newJob().processEventsOnce();

        expect(stock.status).toBe('published');
        expect(notification.status).toBe('pending');
    });

    it('priority\'si olmayan eski kayıt eskisi gibi ilk sırada, priority 3 olaylarla birlikte yayınlanır', async () => {
        const legacy = outbox.seed(Subjects.ProductStockUpdated, stockPayload('legacy'));
        delete legacy.priority;
        const current = outbox.seed(Subjects.ProductStockUpdated, stockPayload('s-1'));
        const later = outbox.seed(Subjects.ProductPriceIntegrationUpdated, { id: 'p-1', userId: 'user-1' });

        await newJob().processEventsOnce();

        expect(legacy.status).toBe('published');
        expect(current.status).toBe('published');
        expect(later.status).toBe('pending');
        const publishedIds = nats.publish.mock.calls.map(([, data]) => JSON.parse(data).id);
        expect(publishedIds[0]).toBe('legacy');
    });

    it('UC-1117: hint reddedilirse (indeks yok/kuruluyor) hint\'siz sorgulanır, yayın durmaz, uyarı dakikada bir basılır', async () => {
        const rejected = Object.assign(new Error('hint provided does not correspond to an existing index'), { code: 2 });
        const realFind = outbox.collection.find.bind(outbox.collection);
        jest.spyOn(outbox.collection, 'find').mockImplementation(filter => {
            const query = realFind(filter);
            // mongoose'ta hint() hata atmaz; sunucu reddi sorgu çalışınca gelir
            query.hint = () => ({ lean: () => Promise.reject(rejected) }) as unknown as typeof query;
            return query;
        });
        Array.from({ length: 3 }, (_, i) => outbox.seed(Subjects.ProductStockUpdated, stockPayload(`s-${i}`)));
        const job = newJob();

        expect(await job.processEventsOnce()).toBe(3);
        outbox.seed(Subjects.ProductStockUpdated, stockPayload('s-late'));
        expect(await job.processEventsOnce()).toBe(1);

        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect((logger.warn as jest.Mock).mock.calls[0][0]).toContain('retrying without hint');
        expect((logger.warn as jest.Mock).mock.calls[0][1]).toBe(rejected);
    });
});

describe('UC-1117 — EventPublisherJob log hacmi', () => {
    let nats: ReturnType<typeof createFakeStan>;
    let outbox: ReturnType<typeof createOutboxStore>;

    const newJob = () => new EventPublisherJob(nats.client, outbox.connection) as unknown as JobInternals;

    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.OUTBOX_DRAIN_BUDGET_MS;
        nats = createFakeStan();
        outbox = createOutboxStore();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('UC-1117: 120 olaylık tur info\'ya olay başına değil tek özet satırı yazar; olay satırları debug\'da', async () => {
        Array.from({ length: 120 }, (_, i) => outbox.seed(Subjects.ProductStockUpdated, stockPayload(`s-${i}`)));

        await newJob().processEvents();

        expect(infoMessages()).toEqual([expect.stringMatching(/^Outbox drain: 120 events in \d+ passes$/)]);
        expect(debugMessages().filter(m => m.startsWith('Successfully published event'))).toHaveLength(120);
    });

    it('bütçe ilk geçişte biterse tek geçişlik tur da özet yazar (eskiden yalnız birden çok geçişte)', async () => {
        Array.from({ length: 5 }, (_, i) => outbox.seed(Subjects.ProductStockUpdated, stockPayload(`s-${i}`)));
        const start = Date.now();
        let calls = 0;
        // ilk okuma son tarihi kurar, sonrakiler bütçenin dışında
        jest.spyOn(Date, 'now').mockImplementation(() => (calls++ === 0 ? start : start + 60_000));

        await newJob().processEvents();

        expect(infoMessages()).toEqual(['Outbox drain: 5 events in 1 passes']);
    });

    it('yayınlanacak olay yoksa tur info yazmaz', async () => {
        await newJob().processEvents();

        expect(logger.info).not.toHaveBeenCalled();
    });

    it('UC-1117: sürüm olayı turu info\'ya tek özet yazar; parti satırları debug\'da', async () => {
        const clock = useFakeClock();
        try {
            Array.from({ length: 250 }, (_, i) => outbox.seed(Subjects.EntityVersionUpdated, versionPayload(`ps-${i}`)));

            await clock.run(newJob().processVersionEventsAsBulk(), 60_000);

            expect(infoMessages()).toEqual(['🔄 Version event drain: 250 events in 3 batches']);
            expect(debugMessages().filter(m => m.startsWith('✅ Bulk published'))).toHaveLength(3);
            expect(debugMessages().filter(m => m.startsWith('🔄 Processing'))).toHaveLength(3);
            expect(debugMessages().filter(m => m.startsWith('✅ EntityVersionBulkUpdated published'))).toHaveLength(3);
        } finally {
            jest.useRealTimers();
        }
    });

    it('tek partilik sürüm olayı turu da özet yazar (eskiden yalnız birden çok partide)', async () => {
        const clock = useFakeClock();
        try {
            Array.from({ length: 5 }, (_, i) => outbox.seed(Subjects.EntityVersionUpdated, versionPayload(`ps-${i}`)));

            await clock.run(newJob().processVersionEventsAsBulk(), 60_000);

            expect(infoMessages()).toEqual(['🔄 Version event drain: 5 events in 1 batches']);
        } finally {
            jest.useRealTimers();
        }
    });
});
