/**
 * UC-1135 — product:stock:updated yayın anında birleştirme (OUTBOX_COALESCE_SUBJECTS, varsayılan kapalı).
 *
 * Partideki aynı (tip, kullanıcı, payload.id) kayıtlarından yalnız en yüksek payload.version yayınlanır; kaybedenler
 * kazanan başarıyla yayınlandıktan SONRA 'superseded' + supersededBy olur, yayın başarısızsa pending'e döner.
 * Bayrak kapalıyken davranış eskisiyle birebir aynıdır.
 * Mongo ve NATS bellek içi taklitleriyle değiştirildi; job kodu olduğu gibi koşar.
 */
import { EventPublisherJob } from '../jobs/eventPublisher.job';
import { EventMetrics } from '../metrics/EventMetrics';
import { Subjects } from '../common';
import { createFakeStan, createOutboxStore, useFakeClock } from '../test/fakes/eventDeliveryHarness';

jest.mock('../services/logger.service', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    }
}));

type JobInternals = {
    processEventsOnce(): Promise<number>;
};

function stockPayload(id: string, version: number, user = 'user-1') {
    return { id, uuid: `uuid-${id}-${version}`, user, version, product: id, quantity: version };
}

const publishedPayloads = (nats: ReturnType<typeof createFakeStan>) =>
    nats.publish.mock.calls.map(([, data]) => JSON.parse(data));

describe('UC-1135 — yayın anında stok olayı birleştirme', () => {
    let nats: ReturnType<typeof createFakeStan>;
    let outbox: ReturnType<typeof createOutboxStore>;
    const originalFlag = process.env.OUTBOX_COALESCE_SUBJECTS;

    const newJob = () => new EventPublisherJob(nats.client, outbox.connection) as unknown as JobInternals;
    const coalescedCount = async () => {
        const metric = (await EventMetrics.getRegistry().getMetricsAsJSON()).find(m => m.name === 'outbox_events_coalesced_total');
        return (metric?.values ?? []).reduce((sum, v) => sum + v.value, 0);
    };

    beforeEach(() => {
        jest.clearAllMocks();
        EventMetrics.reset();
        process.env.OUTBOX_COALESCE_SUBJECTS = Subjects.ProductStockUpdated;
        nats = createFakeStan();
        outbox = createOutboxStore();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
        if (originalFlag === undefined) delete process.env.OUTBOX_COALESCE_SUBJECTS;
        else process.env.OUTBOX_COALESCE_SUBJECTS = originalFlag;
    });

    it('bayrak kapalıyken her satır yayınlanır, hiçbiri superseded olmaz (eski davranış)', async () => {
        delete process.env.OUTBOX_COALESCE_SUBJECTS;
        const records = [1, 2, 3].map(v => outbox.seed(Subjects.ProductStockUpdated, stockPayload('p-1', v)));

        const published = await newJob().processEventsOnce();

        expect(published).toBe(3);
        expect(records.map(r => r.status)).toEqual(['published', 'published', 'published']);
        expect(nats.publish).toHaveBeenCalledTimes(3);
        expect(await coalescedCount()).toBe(0);
    });

    it('bayrakta listelenmeyen tip (sync:requested) açık bayrakta bile birleşmez', async () => {
        process.env.OUTBOX_COALESCE_SUBJECTS = `${Subjects.ProductStockUpdated}, sync:requested`;
        const a = outbox.seed(Subjects.SyncRequested, { id: 's-1', version: 1, userId: 'user-1' });
        const b = outbox.seed(Subjects.SyncRequested, { id: 's-1', version: 2, userId: 'user-1' });

        await newJob().processEventsOnce();

        expect([a.status, b.status]).toEqual(['published', 'published']);
        expect(nats.publish).toHaveBeenCalledTimes(2);
    });

    it('aynı ürünün sürümleri karışık sırada gelse de yalnız en yüksek sürüm yayınlanır, kaybedenler superseded olur', async () => {
        const v2 = outbox.seed(Subjects.ProductStockUpdated, stockPayload('p-1', 2));
        const v5 = outbox.seed(Subjects.ProductStockUpdated, stockPayload('p-1', 5));
        const v3 = outbox.seed(Subjects.ProductStockUpdated, stockPayload('p-1', 3));

        const published = await newJob().processEventsOnce();

        expect(published).toBe(1);
        expect(publishedPayloads(nats).map(p => p.version)).toEqual([5]);
        expect(v5.status).toBe('published');
        expect([v2.status, v3.status]).toEqual(['superseded', 'superseded']);
        expect([v2.supersededBy, v3.supersededBy]).toEqual([v5.id, v5.id]);
        expect(await coalescedCount()).toBe(2);
    });

    it('eşit sürümde ilk gelen kazanır', async () => {
        const first = outbox.seed(Subjects.ProductStockUpdated, stockPayload('p-1', 4));
        const second = outbox.seed(Subjects.ProductStockUpdated, stockPayload('p-1', 4));

        await newJob().processEventsOnce();

        expect(first.status).toBe('published');
        expect(second.status).toBe('superseded');
        expect(second.supersededBy).toBe(first.id);
    });

    it('farklı ürün ve farklı kullanıcının olayları birleşmez', async () => {
        const a = outbox.seed(Subjects.ProductStockUpdated, stockPayload('p-1', 1));
        const b = outbox.seed(Subjects.ProductStockUpdated, stockPayload('p-2', 2));
        const c = outbox.seed(Subjects.ProductStockUpdated, stockPayload('p-1', 3, 'user-2'));

        const published = await newJob().processEventsOnce();

        expect(published).toBe(3);
        expect([a.status, b.status, c.status]).toEqual(['published', 'published', 'published']);
    });

    it('sürümü olmayan olay birleşmez, olduğu gibi yayınlanır', async () => {
        const a = outbox.seed(Subjects.ProductStockUpdated, { id: 'p-1', user: 'user-1' });
        const b = outbox.seed(Subjects.ProductStockUpdated, { id: 'p-1', user: 'user-1' });

        await newJob().processEventsOnce();

        expect([a.status, b.status]).toEqual(['published', 'published']);
    });

    it('farklı tipteki aynı payload.id birleşmez (yalnız bayraktaki tip birleşir)', async () => {
        const stock = outbox.seed(Subjects.ProductStockUpdated, stockPayload('p-1', 1));
        const price = outbox.seed(Subjects.StockUpdated, stockPayload('p-1', 9));

        await newJob().processEventsOnce();

        expect([stock.status, price.status]).toEqual(['published', 'published']);
    });

    it('kazanan yayını başarısızsa kaybedenler superseded olmaz, pending\'e döner ve kayıp olmaz', async () => {
        const clock = useFakeClock();
        const v1 = outbox.seed(Subjects.ProductStockUpdated, stockPayload('p-1', 1));
        const v2 = outbox.seed(Subjects.ProductStockUpdated, stockPayload('p-1', 2));
        nats.publish.mockImplementation((_s: string, _d: string, callback: (err?: Error) => void) => {
            callback(new Error('NATS publish failed: stan connection closed'));
            return 'guid';
        });

        await clock.run(newJob().processEventsOnce(), 120_000);

        expect(v2.status).toBe('failed');
        expect(v1.status).toBe('pending');
        expect(v1.processingStartedAt).toBeUndefined();
        expect(await coalescedCount()).toBe(0);
    });

    it('başka pod\'un claim ettiği kaybeden dokunulmadan kalır', async () => {
        const v1 = outbox.seed(Subjects.ProductStockUpdated, stockPayload('p-1', 1));
        const v2 = outbox.seed(Subjects.ProductStockUpdated, stockPayload('p-1', 2));
        const realUpdateMany = outbox.collection.updateMany.bind(outbox.collection);
        const otherPodClaimedAt = new Date(0);
        jest.spyOn(outbox.collection, 'updateMany').mockImplementationOnce(async () => {
            // başka pod, bu pod'un claim'inden önce v1'i aldı
            v1.status = 'processing';
            v1.processingStartedAt = otherPodClaimedAt;
            return { matchedCount: 0, modifiedCount: 0 };
        }).mockImplementation(realUpdateMany);

        await newJob().processEventsOnce();

        expect(v2.status).toBe('published');
        expect(v1.status).toBe('processing');
        expect(v1.processingStartedAt).toBe(otherPodClaimedAt);
        expect(v1.supersededBy).toBeUndefined();
    });

    it('en yüksek sürüm silme (deleted) olayı olsa da kazanır', async () => {
        const update = outbox.seed(Subjects.ProductStockUpdated, stockPayload('p-1', 1));
        const deleted = outbox.seed(Subjects.ProductStockUpdated, { ...stockPayload('p-1', 2), deleted: true });

        await newJob().processEventsOnce();

        expect(deleted.status).toBe('published');
        expect(update.status).toBe('superseded');
    });
});
