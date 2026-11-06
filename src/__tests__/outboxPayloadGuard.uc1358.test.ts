/**
 * UC-1358 — NATS max_payload'ı aşan outbox kaydı yayınlanmaz, denemeden kalıcı failed olur.
 *
 * Canlıda 12.423 siparişlik Excel export'u 11 MB'lık ExcelFileGenerated yükü üretti. NATS sunucusu
 * "Maximum Payload Exceeded" ile orders'ın bağlantısını kopardı; kayıt her denemede bağlantıyı yeniden
 * kopardığı için servisin bütün NATS trafiği ~33 sn'de bir düştü. Bu testler EventPublisherJob'un
 * böyle bir kaydı hiç göndermediğini ve diğer kayıtların yayınının sürdüğünü sabitler.
 * Mongo ve NATS bellek içi taklitlerdir; üretim kodu olduğu gibi çalışır.
 */
import { EventPublisherJob } from '../jobs/eventPublisher.job';
import { Subjects } from '../common';
import { logger } from '../services/logger.service';
import { createFakeStan, createOutboxStore, useFakeClock } from '../test/fakes/eventDeliveryHarness';

jest.mock('../services/logger.service', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

type PublisherJobInternals = {
    processEvents(): Promise<void>;
    monitorFailedEvents(): Promise<void>;
};

const TICK_INTERVAL_MS = 5 * 60_000;
const DEFAULT_LIMIT = 10 * 1024 * 1024 - 16 * 1024;

function excelPayload(fileBytes: number) {
    return {
        requestId: 'job-1', jobId: 'job-1', userId: 'user-1', serviceName: 'orders',
        filename: 'orders-export.xlsx', fileBuffer: 'A'.repeat(fileBytes), type: 'export', timestamp: new Date()
    };
}

function stockPayload(id: string) {
    return { id, uuid: `uuid-${id}`, user: 'user-1', version: 1, product: 'product-1', quantity: 3 };
}

const payloadSize = (payload: object) => Buffer.byteLength(JSON.stringify(payload), 'utf8');

describe('UC-1358 — EventPublisherJob max payload koruması', () => {
    let nats: ReturnType<typeof createFakeStan>;
    let outbox: ReturnType<typeof createOutboxStore>;
    let clock: ReturnType<typeof useFakeClock>;
    const savedEnv = process.env.OUTBOX_MAX_PAYLOAD_BYTES;

    const newJob = () => new EventPublisherJob(nats.client, outbox.connection) as unknown as PublisherJobInternals;

    async function runTicks(job: PublisherJobInternals, ticks: number) {
        for (let tick = 0; tick < ticks; tick++) {
            await clock.run(job.processEvents(), TICK_INTERVAL_MS);
            await job.monitorFailedEvents();
        }
    }

    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.OUTBOX_MAX_PAYLOAD_BYTES;
        clock = useFakeClock();
        nats = createFakeStan();
        outbox = createOutboxStore();
    });

    afterEach(() => {
        jest.useRealTimers();
        if (savedEnv === undefined) delete process.env.OUTBOX_MAX_PAYLOAD_BYTES;
        else process.env.OUTBOX_MAX_PAYLOAD_BYTES = savedEnv;
    });

    it('10 MB sınırını aşan kayıt hiç gönderilmez, kalıcı failed + hata nedeni yazılır; yeniden denenmez', async () => {
        const big = outbox.seed(Subjects.ExcelFileGenerated, excelPayload(11 * 1024 * 1024));
        const job = newJob();

        await runTicks(job, 10);

        expect(nats.publish).not.toHaveBeenCalled();
        expect(big.status).toBe('failed');
        expect(big.retryCount).toBe(5);
        expect(String(big.error)).toMatch(/payload too large for NATS/);
        expect(String(big.error)).toContain(String(DEFAULT_LIMIT));
        const errorLogs = (logger.error as jest.Mock).mock.calls.map(([m]) => String(m));
        expect(errorLogs.some(m => m.includes('permanently failed without publishing'))).toBe(true);
        // Yük içeriği loga yazılmaz
        expect(JSON.stringify((logger.error as jest.Mock).mock.calls)).not.toContain('AAAAAAAAAA');
    });

    it('büyük kayıt aynı kullanıcının diğer olaylarının yayınını engellemez', async () => {
        const big = outbox.seed(Subjects.ExcelFileGenerated, excelPayload(11 * 1024 * 1024));
        const small = outbox.seed(Subjects.StockUpdated, stockPayload('stock-1'));

        await runTicks(newJob(), 2);

        expect(big.status).toBe('failed');
        expect(small.status).toBe('published');
        expect(nats.publish).toHaveBeenCalledTimes(1);
        expect(nats.publish).toHaveBeenCalledWith(Subjects.StockUpdated, expect.any(String), expect.any(Function));
    });

    it('geriye uyum: sınırın altındaki büyük yük (eski başarılı ~760 KB export) aynen yayınlanır', async () => {
        const record = outbox.seed(Subjects.ExcelFileGenerated, excelPayload(760 * 1024));

        await runTicks(newJob(), 1);

        expect(record.status).toBe('published');
        expect(nats.publish).toHaveBeenCalledWith(Subjects.ExcelFileGenerated, JSON.stringify(record.payload), expect.any(Function));
    });

    it('sınır tam eşikte: limit bayt yayınlanır, limit+1 bayt yayınlanmaz (OUTBOX_MAX_PAYLOAD_BYTES)', async () => {
        const base = payloadSize(excelPayload(0));
        const atLimit = outbox.seed(Subjects.ExcelFileGenerated, { ...excelPayload(1000), requestId: 'job-a' });
        const limit = payloadSize(atLimit.payload as object);
        process.env.OUTBOX_MAX_PAYLOAD_BYTES = String(limit);
        const over = outbox.seed(Subjects.ExcelFileGenerated, { ...excelPayload(1001), requestId: 'job-a' });
        expect(payloadSize(over.payload as object)).toBe(limit + 1);
        expect(base).toBeLessThan(limit);

        await runTicks(newJob(), 1);

        expect(atLimit.status).toBe('published');
        expect(over.status).toBe('failed');
        expect(over.retryCount).toBe(5);
    });

    it('bağlı NATS sunucusu daha küçük max_payload bildiriyorsa o sınır (zarf payı düşülerek) kullanılır', async () => {
        (nats.client as any).nc = { info: { max_payload: 1024 * 1024 } };
        const record = outbox.seed(Subjects.ExcelFileGenerated, excelPayload(1024 * 1024));

        await runTicks(newJob(), 1);

        expect(nats.publish).not.toHaveBeenCalled();
        expect(record.status).toBe('failed');
        expect(String(record.error)).toContain(String(1024 * 1024 - 16 * 1024));
    });
});
