/**
 * UC-1533 — Başarısız yayında asıl hata nedeni outbox kaydına yazılır (lastError/lastErrorAt).
 * UC-1526'da 2 takılı kaydın nedeni ancak yük boyutundan çıkarılabildi; artık kayıt kendisi söyler.
 * Mongo ve NATS bellek içi taklitlerdir; üretim kodu olduğu gibi çalışır.
 */
import { EventPublisherJob } from '../jobs/eventPublisher.job';
import { Subjects } from '../common';
import { createFakeStan, createOutboxStore, useFakeClock } from '../test/fakes/eventDeliveryHarness';

jest.mock('../services/logger.service', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

type Rec = Record<string, any>;
type JobInternals = {
    processEvents(): Promise<void>;
    processVersionEventsAsBulk(): Promise<void>;
    markPublishFailed(filter: Rec, retryCount: number, error?: unknown): Promise<void>;
};

const TICK_MS = 5 * 60_000;
const WINDOW_MS = 15_000;

const stockPayload = (id: string) => ({ id, uuid: `uuid-${id}`, user: 'user-1', version: 1, product: 'product-1', quantity: 3 });
const versionPayload = (entityId: string) =>
    ({ entityType: 'ProductStock', entityId, service: 'inventory', version: 2, previousVersion: 1, timestamp: new Date(), userId: 'user-1' });

describe('UC-1533 — outbox lastError', () => {
    let nats: ReturnType<typeof createFakeStan>;
    let outbox: ReturnType<typeof createOutboxStore>;
    let clock: ReturnType<typeof useFakeClock>;
    let job: JobInternals;

    beforeEach(() => {
        jest.clearAllMocks();
        clock = useFakeClock();
        nats = createFakeStan();
        outbox = createOutboxStore();
        job = new EventPublisherJob(nats.client, outbox.connection) as unknown as JobInternals;
    });
    afterEach(() => jest.useRealTimers());

    it('tekil yol: yayın hatası lastError + lastErrorAt olarak yazılır', async () => {
        const record = outbox.seed(Subjects.StockUpdated, stockPayload('stock-1'));
        nats.setPublishFails(true);

        await clock.run(job.processEvents(), TICK_MS);

        expect(record.status).toBe('failed');
        expect(String(record.lastError)).toContain('NATS publish failed: stan connection closed');
        expect(record.lastErrorAt).toBeInstanceOf(Date);
    });

    it('toplu yol (entity:version-updated): her kayda hata yazılır', async () => {
        const a = outbox.seed(Subjects.EntityVersionUpdated, versionPayload('product-stock-1'));
        const b = outbox.seed(Subjects.EntityVersionUpdated, versionPayload('product-stock-2'));
        nats.setPublishFails(true);

        await clock.run(job.processVersionEventsAsBulk(), WINDOW_MS);

        for (const record of [a, b]) {
            expect(record.status).toBe('failed');
            expect(String(record.lastError)).toContain('NATS publish failed');
            expect(record.lastErrorAt).toBeInstanceOf(Date);
        }
    });

    it('kalıcı failed (hak bitti) kayıtta da lastError yazılır', async () => {
        const record = outbox.seed(Subjects.StockUpdated, stockPayload('stock-1'));
        Object.assign(record, { status: 'processing', retryCount: 4, processingStartedAt: new Date() });

        await job.markPublishFailed({ _id: record.id }, 4, new Error('son deneme hatası'));

        expect(record).toMatchObject({ status: 'failed', retryCount: 5 });
        expect(record.nextAttemptAt).toBeUndefined();
        expect(String(record.lastError)).toContain('son deneme hatası');
    });

    it('sırlar maskelenir: bağlantı dizgesi parolası ve Bearer token kayda girmez', async () => {
        const record = outbox.seed(Subjects.StockUpdated, stockPayload('stock-1'));
        Object.assign(record, { status: 'processing', retryCount: 0, processingStartedAt: new Date() });

        await job.markPublishFailed({ _id: record.id }, 0,
            new Error('connect nats://svcuser:S3cretPass@nats.internal:4222 refused; Authorization: Bearer abc123tokenvalue'));

        const stored = String(record.lastError);
        expect(stored).toContain('refused');
        expect(stored).not.toContain('S3cretPass');
        expect(stored).not.toContain('abc123tokenvalue');
    });

    it('çok uzun hata 1000 karaktere kesilir', async () => {
        const record = outbox.seed(Subjects.StockUpdated, stockPayload('stock-1'));
        Object.assign(record, { status: 'processing', retryCount: 0, processingStartedAt: new Date() });

        await job.markPublishFailed({ _id: record.id }, 0, new Error('x'.repeat(5000)));

        expect(String(record.lastError).length).toBe(1000);
        expect(String(record.lastError).endsWith('…')).toBe(true);
    });

    it('Error olmayan değer de metne çevrilir; hata verilmezse alanlar yazılmaz (geriye uyum)', async () => {
        const a = outbox.seed(Subjects.StockUpdated, stockPayload('stock-1'));
        const b = outbox.seed(Subjects.StockUpdated, stockPayload('stock-2'));
        for (const r of [a, b]) Object.assign(r, { status: 'processing', retryCount: 0, processingStartedAt: new Date() });

        await job.markPublishFailed({ _id: a.id }, 0, 'düz metin hata');
        await job.markPublishFailed({ _id: b.id }, 0);

        expect(a.lastError).toBe('düz metin hata');
        expect(b.status).toBe('failed');
        expect(b.lastError).toBeUndefined();
        expect(b.lastErrorAt).toBeUndefined();
    });

    it('başarılı yayın davranışı değişmez: published kayıtta lastError yok', async () => {
        const record = outbox.seed(Subjects.StockUpdated, stockPayload('stock-1'));
        await clock.run(job.processEvents(), TICK_MS);
        expect(record.status).toBe('published');
        expect(record.lastError).toBeUndefined();
    });
});
