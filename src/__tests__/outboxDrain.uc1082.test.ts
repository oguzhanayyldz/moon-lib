/**
 * UC-1082 — normal outbox olayları tur başına zaman bütçesiyle boşaltılır.
 *
 * Önce: processEvents 3 sn'de bir tek geçiş yapıyordu (kullanıcı başına en çok 50 olay). Tek kullanıcının
 * tavanı ~1.000 olay/dk idi; yük kümesinde 10.000 siparişin ~40.000 iş olayı 40 dk'da boşalıyordu.
 * Sonra: geçiş, bütçe (OUTBOX_DRAIN_BUDGET_MS, varsayılan 2000 ms) dolana ya da bir geçiş hiç olay
 * yayınlamayana kadar tekrarlanır; priority geçiş beklemesi ve üst üste tur koruması korunur.
 * Mongo ve NATS bellek içi taklitlerle değiştirildi; job kodu olduğu gibi koşar.
 */
import { EventPublisherJob } from '../jobs/eventPublisher.job';
import { Subjects } from '../common';
import { createFakeStan, createOutboxStore } from '../test/fakes/eventDeliveryHarness';

jest.mock('../services/logger.service', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    }
}));

const SINGLE_PASS_LIMIT = 50;

type PublisherJobInternals = {
    processEvents(): Promise<void>;
    processEventsOnce(): Promise<number>;
};

function stockPayload(id: string) {
    return { id, uuid: `uuid-${id}`, user: 'user-1', version: 1, product: 'product-1', quantity: 3 };
}

describe('UC-1082 — EventPublisherJob normal olay boşaltma döngüsü', () => {
    let nats: ReturnType<typeof createFakeStan>;
    let outbox: ReturnType<typeof createOutboxStore>;
    const originalBudget = process.env.OUTBOX_DRAIN_BUDGET_MS;

    function createJob(): PublisherJobInternals {
        return new EventPublisherJob(nats.client, outbox.connection) as unknown as PublisherJobInternals;
    }

    function seedStock(count: number) {
        return Array.from({ length: count }, (_, i) => outbox.seed(Subjects.StockUpdated, stockPayload(`stock-${i}`)));
    }

    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.OUTBOX_DRAIN_BUDGET_MS;
        nats = createFakeStan();
        outbox = createOutboxStore();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (originalBudget === undefined) delete process.env.OUTBOX_DRAIN_BUDGET_MS;
        else process.env.OUTBOX_DRAIN_BUDGET_MS = originalBudget;
    });

    it('tek tur, tek kullanıcının 50 olaylık geçiş tavanını aşıp kuyruğu boşaltır', async () => {
        const records = seedStock(120);

        await createJob().processEvents();

        expect(records.filter(r => r.status === 'published')).toHaveLength(120);
        expect(nats.publish).toHaveBeenCalledTimes(120);
    });

    it('OUTBOX_DRAIN_BUDGET_MS=0 eski tek geçiş davranışını korur', async () => {
        process.env.OUTBOX_DRAIN_BUDGET_MS = '0';
        const records = seedStock(120);

        await createJob().processEvents();

        expect(records.filter(r => r.status === 'published')).toHaveLength(SINGLE_PASS_LIMIT);
    });

    it('geçersiz OUTBOX_DRAIN_BUDGET_MS varsayılan bütçeye düşer', async () => {
        process.env.OUTBOX_DRAIN_BUDGET_MS = 'abc';
        const records = seedStock(120);

        await createJob().processEvents();

        expect(records.filter(r => r.status === 'published')).toHaveLength(120);
    });

    it('bütçe dolunca tur durur, kalanlar sonraki tura kalır', async () => {
        const records = seedStock(120);
        const job = createJob();
        // Her Date.now çağrısı 3 sn ilerler: ilk geçiş bitince 2 sn'lik bütçe aşılmış olur
        let now = 1_000_000;
        jest.spyOn(Date, 'now').mockImplementation(() => (now += 3_000));

        await job.processEvents();

        expect(records.filter(r => r.status === 'published')).toHaveLength(SINGLE_PASS_LIMIT);
    });

    it('yayın yapamayan geçişte döngü durur (yayınlanacak olay yoksa tekrar sorgulamaz)', async () => {
        const job = createJob();
        const once = jest.spyOn(job, 'processEventsOnce');

        await job.processEvents();

        expect(once).toHaveBeenCalledTimes(1);
    });

    it('priority geçiş beklemesi döngüde de korunur: düşük öncelikli olaylar aynı turda yayınlanmaz', async () => {
        const high = seedStock(60);
        const low = Array.from({ length: 10 }, (_, i) => outbox.seed(Subjects.StockUpdated, stockPayload(`late-${i}`)));
        low.forEach(record => { record.priority = 4; });

        await createJob().processEvents();

        expect(high.filter(r => r.status === 'published')).toHaveLength(60);
        expect(low.filter(r => r.status === 'pending')).toHaveLength(10);
    });

    it('önceki tur sürerken başlayan tur hiçbir geçiş yapmadan döner', async () => {
        seedStock(120);
        const job = createJob();
        const once = jest.spyOn(job, 'processEventsOnce');

        const first = job.processEvents();
        await job.processEvents();
        const passesWhileFirstRunning = once.mock.calls.length;
        await first;

        expect(passesWhileFirstRunning).toBe(1);
        expect(nats.publish).toHaveBeenCalledTimes(120);
    });
});
