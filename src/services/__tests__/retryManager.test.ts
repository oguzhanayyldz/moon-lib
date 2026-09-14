import { RetryManager } from '../retryManager';
import { redisWrapper } from '../redisWrapper.service';

jest.mock('../redisWrapper.service', () => {
    const store = new Map<string, string>();
    return {
        redisWrapper: {
            client: {
                store,
                get: jest.fn(async (key: string) => store.get(key) ?? null),
                set: jest.fn(async (key: string, value: string) => {
                    store.set(key, value);
                    return 'OK';
                }),
                del: jest.fn(async (key: string) => (store.delete(key) ? 1 : 0))
            }
        }
    };
});

type FakeClient = typeof redisWrapper.client & { store: Map<string, string> };

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_REDIS_KEY_ENV = process.env.REDIS_KEY_ENV;
const EVENT_TYPE = 'product:stock:updated';
const EVENT_ID = 'svc-stock-42-v3';

/**
 * RetryManager key names (ENV-ISO, TASK-MU1QNQKCOKD07).
 * Production must keep the historical `event:retry:*` names so live counters survive a
 * deploy; every other environment counts in its own namespace so its failures never
 * consume production's retry budget for the same eventId.
 */
describe('RetryManager environment-scoped keys', () => {
    const client = redisWrapper.client as unknown as FakeClient;

    beforeEach(() => {
        client.store.clear();
        jest.clearAllMocks();
        delete process.env.REDIS_KEY_ENV;
    });

    afterEach(() => {
        if (ORIGINAL_NODE_ENV === undefined) {
            delete process.env.NODE_ENV;
        } else {
            process.env.NODE_ENV = ORIGINAL_NODE_ENV;
        }
        if (ORIGINAL_REDIS_KEY_ENV === undefined) {
            delete process.env.REDIS_KEY_ENV;
        } else {
            process.env.REDIS_KEY_ENV = ORIGINAL_REDIS_KEY_ENV;
        }
    });

    it('keeps the unscoped key names with REDIS_KEY_ENV=production although NODE_ENV=development (invoice/shipment in production)', async () => {
        process.env.NODE_ENV = 'development';
        process.env.REDIS_KEY_ENV = 'production';
        const manager = new RetryManager();

        await manager.incrementRetryCount(EVENT_TYPE, EVENT_ID);
        await manager.scheduleRetry(EVENT_TYPE, EVENT_ID, 1000);

        expect([...client.store.keys()].sort()).toEqual([
            `event:retry:${EVENT_TYPE}:${EVENT_ID}`,
            `event:retry:scheduled:${EVENT_TYPE}:${EVENT_ID}`
        ]);
    });

    it('reads, checks and clears the unscoped names with REDIS_KEY_ENV=production although NODE_ENV=development (full retry cycle)', async () => {
        process.env.NODE_ENV = 'development';
        process.env.REDIS_KEY_ENV = 'production';
        const manager = new RetryManager({ maxRetries: 2 });

        await manager.incrementRetryCount(EVENT_TYPE, EVENT_ID);
        expect(await manager.incrementRetryCount(EVENT_TYPE, EVENT_ID)).toBe(2);
        expect(await manager.getRetryCount(EVENT_TYPE, EVENT_ID)).toBe(2);
        expect(await manager.shouldRetry(EVENT_TYPE, EVENT_ID)).toBe(false);

        await manager.scheduleRetry(EVENT_TYPE, EVENT_ID, 60000);
        expect(await manager.isRetryScheduled(EVENT_TYPE, EVENT_ID)).toBe(true);
        expect([...client.store.keys()].sort()).toEqual([
            `event:retry:${EVENT_TYPE}:${EVENT_ID}`,
            `event:retry:scheduled:${EVENT_TYPE}:${EVENT_ID}`
        ]);

        await manager.resetRetryCount(EVENT_TYPE, EVENT_ID);
        await manager.clearScheduledRetry(EVENT_TYPE, EVENT_ID);
        expect(client.store.size).toBe(0);
    });

    it('keeps the unscoped retry and schedule key names in production', async () => {
        process.env.NODE_ENV = 'production';
        const manager = new RetryManager();

        await manager.incrementRetryCount(EVENT_TYPE, EVENT_ID);
        await manager.scheduleRetry(EVENT_TYPE, EVENT_ID, 1000);

        expect([...client.store.keys()].sort()).toEqual([
            `event:retry:${EVENT_TYPE}:${EVENT_ID}`,
            `event:retry:scheduled:${EVENT_TYPE}:${EVENT_ID}`
        ]);
    });

    it('keeps the unscoped key names when NODE_ENV is missing (outbox default)', async () => {
        delete process.env.NODE_ENV;
        const manager = new RetryManager();

        await manager.incrementRetryCount(EVENT_TYPE, EVENT_ID);

        expect([...client.store.keys()]).toEqual([`event:retry:${EVENT_TYPE}:${EVENT_ID}`]);
    });

    it('writes every retry and schedule key under the development namespace', async () => {
        process.env.NODE_ENV = 'development';
        const manager = new RetryManager();

        await manager.incrementRetryCount(EVENT_TYPE, EVENT_ID);
        await manager.scheduleRetry(EVENT_TYPE, EVENT_ID, 1000);

        expect([...client.store.keys()].sort()).toEqual([
            `development:event:retry:${EVENT_TYPE}:${EVENT_ID}`,
            `development:event:retry:scheduled:${EVENT_TYPE}:${EVENT_ID}`
        ]);
    });

    it("does not read or reset another environment's counter for the same eventId", async () => {
        client.store.set(`event:retry:${EVENT_TYPE}:${EVENT_ID}`, '4');
        client.store.set(`event:retry:scheduled:${EVENT_TYPE}:${EVENT_ID}`, String(Date.now() + 60000));

        process.env.NODE_ENV = 'development';
        const manager = new RetryManager();

        expect(await manager.getRetryCount(EVENT_TYPE, EVENT_ID)).toBe(0);
        expect(await manager.shouldRetry(EVENT_TYPE, EVENT_ID)).toBe(true);
        expect(await manager.isRetryScheduled(EVENT_TYPE, EVENT_ID)).toBe(false);
        expect(await manager.incrementRetryCount(EVENT_TYPE, EVENT_ID)).toBe(1);

        await manager.resetRetryCount(EVENT_TYPE, EVENT_ID);
        await manager.clearScheduledRetry(EVENT_TYPE, EVENT_ID);

        expect(client.store.get(`event:retry:${EVENT_TYPE}:${EVENT_ID}`)).toBe('4');
        expect(client.store.has(`event:retry:scheduled:${EVENT_TYPE}:${EVENT_ID}`)).toBe(true);
        expect(client.store.has(`development:event:retry:${EVENT_TYPE}:${EVENT_ID}`)).toBe(false);
    });

    it('reads back its own counter and schedule within the same environment', async () => {
        process.env.NODE_ENV = 'development';
        const manager = new RetryManager({ maxRetries: 2 });

        await manager.incrementRetryCount(EVENT_TYPE, EVENT_ID);
        expect(await manager.incrementRetryCount(EVENT_TYPE, EVENT_ID)).toBe(2);
        expect(await manager.getRetryCount(EVENT_TYPE, EVENT_ID)).toBe(2);
        expect(await manager.shouldRetry(EVENT_TYPE, EVENT_ID)).toBe(false);

        await manager.scheduleRetry(EVENT_TYPE, EVENT_ID, 60000);
        expect(await manager.isRetryScheduled(EVENT_TYPE, EVENT_ID)).toBe(true);

        await manager.resetRetryCount(EVENT_TYPE, EVENT_ID);
        await manager.clearScheduledRetry(EVENT_TYPE, EVENT_ID);
        expect(client.store.size).toBe(0);
    });
});
