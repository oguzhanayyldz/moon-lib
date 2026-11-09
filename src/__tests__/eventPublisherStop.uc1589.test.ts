/**
 * UC-1589 — start() ilk setTimeout tutamacını saklamıyordu: stop() initialDelay (≤ ~2,6 sn) içinde
 * çağrılırsa zamanlayıcı sonradan interval'leri yine kuruyordu (kapalı bağlantılara karşı hata logu).
 * Mongo ve NATS bellek içi taklitlerdir; üretim kodu olduğu gibi çalışır.
 */
import { EventPublisherJob } from '../jobs/eventPublisher.job';
import { createFakeStan, createOutboxStore } from '../test/fakes/eventDeliveryHarness';

jest.mock('../services/logger.service', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

type Internals = {
    intervalId: unknown;
    versionEventIntervalId: unknown;
    monitoringId: unknown;
    processEvents: jest.Mock;
};

describe('UC-1589 — stop() initialDelay içinde', () => {
    let job: EventPublisherJob;
    let internals: Internals;

    beforeEach(() => {
        jest.useFakeTimers();
        job = new EventPublisherJob(createFakeStan().client, createOutboxStore().connection);
        internals = job as unknown as Internals;
        internals.processEvents = jest.fn().mockResolvedValue(undefined);
    });
    afterEach(() => {
        job.stop();
        jest.useRealTimers();
    });

    it('stop() initialDelay dolmadan çağrılırsa interval kurulmaz', async () => {
        await job.start();
        job.stop();

        expect(jest.getTimerCount()).toBe(0); // bekleyen initialDelay zamanlayıcısı hemen temizlendi

        jest.advanceTimersByTime(10_000); // initialDelay (≤ ~2,6 sn) fazlasıyla geçer

        expect(internals.intervalId).toBeNull();
        expect(internals.versionEventIntervalId).toBeNull();
        expect(internals.monitoringId).toBeNull();
        expect(internals.processEvents).not.toHaveBeenCalled();
        expect(jest.getTimerCount()).toBe(0);
    });

    it('stopped bayrağı: clearTimeout etkisiz kalsa bile (geri çağrı kuyruğa girmiş) interval kurulmaz', async () => {
        const clearSpy = jest.spyOn(global, 'clearTimeout').mockImplementation(() => undefined);
        try {
            await job.start();
            job.stop();
            jest.advanceTimersByTime(10_000);

            expect(internals.intervalId).toBeNull();
            expect(internals.versionEventIntervalId).toBeNull();
            expect(internals.monitoringId).toBeNull();
        } finally {
            clearSpy.mockRestore();
        }
    });

    it('stop() çağrılmazsa interval\'ler kurulur (normal yol bozulmadı)', async () => {
        await job.start();
        jest.advanceTimersByTime(10_000);

        expect(internals.intervalId).not.toBeNull();
        expect(internals.versionEventIntervalId).not.toBeNull();
        expect(internals.monitoringId).not.toBeNull();
    });

    it('stop() sonrası start() yeniden başlatır (bayrak sıfırlanır)', async () => {
        await job.start();
        job.stop();
        await job.start();
        jest.advanceTimersByTime(10_000);

        expect(internals.intervalId).not.toBeNull();
    });
});
