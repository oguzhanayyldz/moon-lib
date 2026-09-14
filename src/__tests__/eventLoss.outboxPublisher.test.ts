/**
 * Issue #648 · 648-G1 reproduction — K-1: a `failed` outbox record is terminal.
 *
 * Before 648-G3 (moon-lib 11677f7) EventPublisherJob marked a record `failed` when
 * publishEvent threw (jobs/eventPublisher.job.ts:365-372), but every publish query selected
 * only `pending` records (:220-223, :241-247, :256-262, :388-393) and no code moved
 * `failed` back to `pending`. The `retryCount < 5` filter and the ALERT
 * (`failed` + `retryCount >= 5`, :486-492) therefore never took effect.
 *
 * publishEvent throws only after the publisher's own in-process retries are used up
 * (66 of 69 publishers, e.g. publishers/stockUpdated.publisher.ts: 5 attempts,
 * 1+2+3+4 s apart), so the trigger is a NATS outage longer than ~10 s.
 *
 * Tests marked "K-1:" failed on 11677f7 and pass with the 648-G3 fix; tests marked "G3:"
 * pin the safety properties of that fix (back-off, no automatic replay of old records, no double claim).
 * Production code is exercised as-is; only Mongo and NATS are replaced by in-memory fakes.
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

const PUBLISH_ATTEMPT_LIMIT = 5;
const PUBLISHER_IN_PROCESS_ATTEMPTS = 5;
const TICKS = 10;
// Generous simulated gap between ticks: covers the publisher back-off and any retry back-off a fix may add.
const TICK_INTERVAL_MS = 5 * 60_000;

type PublisherJobInternals = {
    processEvents(): Promise<void>;
    processVersionEventsAsBulk(): Promise<void>;
    monitorFailedEvents(): Promise<void>;
    processOneEvent(event: Record<string, any>): Promise<void>;
};

function stockPayload(id: string) {
    return { id, uuid: `uuid-${id}`, user: 'user-1', version: 1, product: 'product-1', quantity: 3 };
}

function versionPayload(entityId: string) {
    return { entityType: 'ProductStock', entityId, service: 'inventory', version: 2, previousVersion: 1, timestamp: new Date(), userId: 'user-1' };
}

describe('#648 K-1 — EventPublisherJob: failed outbox record is never published again', () => {
    let nats: ReturnType<typeof createFakeStan>;
    let outbox: ReturnType<typeof createOutboxStore>;
    let job: PublisherJobInternals;
    let clock: ReturnType<typeof useFakeClock>;

    async function runTicks(ticks: number, step: () => Promise<void>) {
        for (let tick = 0; tick < ticks; tick++) {
            await clock.run(step(), TICK_INTERVAL_MS);
            await job.monitorFailedEvents();
        }
    }

    const normalTick = () => job.processEvents();
    const versionTick = () => job.processVersionEventsAsBulk();

    beforeEach(() => {
        jest.clearAllMocks();
        clock = useFakeClock();
        nats = createFakeStan();
        outbox = createOutboxStore();
        job = new EventPublisherJob(nats.client, outbox.connection) as unknown as PublisherJobInternals;
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('control: a pending record is published and marked published', async () => {
        const record = outbox.seed(Subjects.StockUpdated, stockPayload('stock-1'));

        await runTicks(1, normalTick);

        expect(nats.publish).toHaveBeenCalledWith(Subjects.StockUpdated, JSON.stringify(record.payload), expect.any(Function));
        expect(record.status).toBe('published');
    });

    it('control: a NATS error shorter than the publisher in-process retries does not fail the record', async () => {
        const record = outbox.seed(Subjects.StockUpdated, stockPayload('stock-1'));
        nats.publish.mockImplementationOnce((_subject: string, _data: string, callback: (err?: Error) => void) => {
            callback(new Error('NATS publish failed: stan connection closed'));
            return 'guid';
        });

        await runTicks(1, normalTick);

        expect(record.status).toBe('published');
        expect(nats.publish).toHaveBeenCalledTimes(2);
    });

    it('K-1: after a NATS outage that outlasts the publisher retries, the record must be published once NATS recovers', async () => {
        const record = outbox.seed(Subjects.StockUpdated, stockPayload('stock-1'));

        nats.setPublishFails(true);
        await runTicks(1, normalTick);
        // Precondition: the attempt was made, counted and did not publish (the status is the fix's choice).
        expect(nats.publish).toHaveBeenCalledTimes(PUBLISHER_IN_PROCESS_ATTEMPTS);
        expect(record.retryCount).toBe(1);
        expect(record.status).not.toBe('published');

        nats.setPublishFails(false);
        await runTicks(TICKS, normalTick);

        expect(record.status).toBe('published');
    });

    it(`K-1: a record whose publish keeps failing must be retried by the job up to the limit (${PUBLISH_ATTEMPT_LIMIT})`, async () => {
        const record = outbox.seed(Subjects.StockUpdated, stockPayload('stock-1'));

        nats.setPublishFails(true);
        await runTicks(TICKS, normalTick);

        expect(record.retryCount).toBe(PUBLISH_ATTEMPT_LIMIT);
    });

    it('K-1: permanently failing records must raise the ALERT of monitorFailedEvents', async () => {
        for (let index = 0; index < PUBLISH_ATTEMPT_LIMIT; index++) {
            outbox.seed(Subjects.StockUpdated, stockPayload(`stock-${index}`));
        }

        nats.setPublishFails(true);
        await runTicks(TICKS, normalTick);

        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('ALERT'));
    });

    it('K-1: bulk EntityVersionUpdated records that failed once must be published once NATS recovers', async () => {
        const record = outbox.seed(Subjects.EntityVersionUpdated, versionPayload('product-stock-1'));

        nats.setPublishFails(true);
        await runTicks(1, versionTick);
        // Precondition: the bulk attempt was made, counted and did not publish (the status is the fix's choice).
        expect(record.retryCount).toBe(1);
        expect(record.status).not.toBe('published');

        nats.setPublishFails(false);
        await runTicks(TICKS, versionTick);

        expect(record.status).toBe('published');
        expect(nats.publish).toHaveBeenLastCalledWith(Subjects.EntityVersionBulkUpdated, expect.any(String), expect.any(Function));
    });

    it('G3: a failed record is requeued only after its back-off delay has elapsed', async () => {
        const record = outbox.seed(Subjects.StockUpdated, stockPayload('stock-1'));
        nats.setPublishFails(true);

        // 15 s covers the publisher in-process retries (1+2+3+4 s), the first job back-off is 30 s.
        await clock.run(job.processEvents(), 15_000);
        await job.monitorFailedEvents();
        expect(record).toMatchObject({ status: 'failed', retryCount: 1 });
        expect(record.nextAttemptAt).toBeInstanceOf(Date);

        await clock.advance(30_000);
        await job.monitorFailedEvents();
        expect(record.status).toBe('pending');
        expect(record.nextAttemptAt).toBeUndefined();
    });

    it('G3: a record that used up its publish attempts stays failed and is not requeued', async () => {
        const record = outbox.seed(Subjects.StockUpdated, stockPayload('stock-1'));

        nats.setPublishFails(true);
        await runTicks(TICKS, normalTick);
        nats.setPublishFails(false);
        const publishCallsBeforeRecovery = nats.publish.mock.calls.length;
        await runTicks(TICKS, normalTick);

        expect(record).toMatchObject({ status: 'failed', retryCount: PUBLISH_ATTEMPT_LIMIT });
        expect(nats.publish).toHaveBeenCalledTimes(publishCallsBeforeRecovery);
    });

    it('G3: a failed record written before the fix (no nextAttemptAt) is not replayed automatically', async () => {
        const record = outbox.seed(Subjects.StockUpdated, stockPayload('stock-1'));
        Object.assign(record, { status: 'failed', retryCount: 1, lastAttempt: new Date() });

        await runTicks(TICKS, normalTick);

        expect(record).toMatchObject({ status: 'failed', retryCount: 1 });
        expect(nats.publish).not.toHaveBeenCalled();
    });

    it('G3: a publisher holding a stale read of a requeued record cannot claim and publish it again', async () => {
        const record = outbox.seed(Subjects.StockUpdated, stockPayload('stock-1'));
        const staleRead = { ...record };

        nats.setPublishFails(true);
        await runTicks(1, normalTick);
        expect(record).toMatchObject({ status: 'pending', retryCount: 1 });
        nats.setPublishFails(false);
        nats.publish.mockClear();

        // A second pod read the record before the failed attempt and only now tries to claim it.
        await job.processOneEvent(staleRead);
        expect(nats.publish).not.toHaveBeenCalled();
        expect(record.status).toBe('pending');

        await runTicks(1, normalTick);
        expect(nats.publish).toHaveBeenCalledTimes(1);
        expect(record.status).toBe('published');
    });
});
