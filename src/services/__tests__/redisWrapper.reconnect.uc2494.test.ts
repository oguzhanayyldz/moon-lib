import { createClient } from 'redis';
import { redisWrapper, getRedisReconnectDelay } from '../redisWrapper.service';
import { logger } from '../logger.service';

/**
 * UC-2494: Redis 13 dk içinde 7 kez yeniden başladı; node-redis istemcisi "The client is closed"da kaldı.
 * Kök neden: reconnectStrategy 10 denemeden sonra Error döndürüyordu → node-redis isOpen=false yapıp 'end'
 * YAYMADAN kapanıyordu; servislerin 'end' işleyicisi hiç tetiklenmiyor, istemci bir daha açılmıyordu.
 */

jest.mock('redis', () => ({
    createClient: jest.fn()
}));

jest.mock('../logger.service', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

type EventHandler = (payload?: unknown) => void;

interface FakeRedisClient {
    handlers: Record<string, EventHandler>;
    isOpen: boolean;
    isReady: boolean;
    on: jest.Mock;
    connect: jest.Mock;
    ping: jest.Mock;
    quit: jest.Mock;
    disconnect: jest.Mock;
}

const mockedCreateClient = createClient as unknown as jest.Mock;
const mockedLogger = jest.mocked(logger);

const createFakeClient = (): FakeRedisClient => {
    const client: FakeRedisClient = {
        handlers: {},
        isOpen: true,
        isReady: true,
        on: jest.fn(),
        connect: jest.fn(),
        ping: jest.fn().mockResolvedValue('PONG'),
        quit: jest.fn().mockResolvedValue('OK'),
        disconnect: jest.fn().mockResolvedValue(undefined),
    };
    client.on.mockImplementation((event: string, handler: EventHandler) => {
        client.handlers[event] = handler;
        return client;
    });
    // Gerçek node-redis gibi: connect() isOpen'ı eşzamanlı true yapar, 'ready' sonra gelir.
    client.connect.mockImplementation(() => {
        client.isOpen = true;
        return Promise.resolve().then(() => {
            client.isReady = true;
            client.handlers.ready?.();
            return client;
        });
    });
    return client;
};

/** node-redis'in reconnectStrategy vazgeçince yaptığı: isOpen=false + 'error'; 'end' YOK. */
const simulateReconnectGaveUp = (client: FakeRedisClient) => {
    client.isOpen = false;
    client.isReady = false;
    client.handlers.error?.(new Error('connect ECONNREFUSED 127.0.0.1:6379'));
};

const URL_A = 'redis://127.0.0.1:6391';

describe('redisWrapper reconnect after Redis restarts (UC-2494)', () => {
    let fake: FakeRedisClient;

    beforeEach(async () => {
        jest.clearAllMocks();
        await redisWrapper.disconnect().catch(() => undefined);
        fake = createFakeClient();
        mockedCreateClient.mockReturnValue(fake);
        await redisWrapper.connect(URL_A, 1000);
        fake.connect.mockClear();
    });

    afterEach(async () => {
        fake.isOpen = true;
        await redisWrapper.disconnect().catch(() => undefined);
    });

    it('reconnectStrategy never gives up: every retry count yields a numeric delay (never Error/false)', () => {
        const strategy = mockedCreateClient.mock.calls[0][0].socket.reconnectStrategy as (retries: number) => unknown;
        const retryCounts = [0, 1, 5, 10, 11, 12, 50, 1000];
        // Önce kök neden: hiçbir deneme sayısında Error/false dönmemeli (eskisi 11'de Error dönüyordu).
        expect(retryCounts.map((retries) => typeof strategy(retries))).toEqual(retryCounts.map(() => 'number'));
        for (const retries of retryCounts) {
            const result = strategy(retries) as number;
            expect(result).toBeGreaterThan(0);
            expect(result).toBeLessThanOrEqual(10000);
        }
        expect(getRedisReconnectDelay(0)).toBe(1000);
        expect(getRedisReconnectDelay(3)).toBe(8000);
        expect(getRedisReconnectDelay(4)).toBe(10000);
        expect(getRedisReconnectDelay(10000)).toBe(10000);
    });

    it('closed client (gave up, no end) is reopened on the SAME object and runs commands again', async () => {
        const heldByRateLimiter = redisWrapper.client; // RateLimiter/security service referansı açılışta saklar
        simulateReconnectGaveUp(fake);

        const client = redisWrapper.client;
        expect(client).toBe(heldByRateLimiter);
        expect(fake.connect).toHaveBeenCalledTimes(1);
        expect(client.isOpen).toBe(true);

        await redisWrapper.reopenClosedClient();
        await expect(heldByRateLimiter.ping()).resolves.toBe('PONG');
        expect(fake.isReady).toBe(true);
        expect(mockedCreateClient).toHaveBeenCalledTimes(1); // yeni istemci kurulmadı
    });

    it('concurrent accesses while closed trigger exactly one reopen (single flight)', async () => {
        let finishConnect: () => void = () => undefined;
        fake.connect.mockImplementation(() => {
            fake.isOpen = true;
            return new Promise<void>((resolve) => { finishConnect = resolve; });
        });
        simulateReconnectGaveUp(fake);

        const reopens = [
            redisWrapper.reopenClosedClient(),
            redisWrapper.reopenClosedClient(),
            redisWrapper.reopenClosedClient(),
        ];
        for (let i = 0; i < 5; i++) {
            void redisWrapper.client;
        }
        expect(new Set(reopens).size).toBe(1);
        expect(fake.connect).toHaveBeenCalledTimes(1);

        finishConnect();
        await Promise.all(reopens);
        expect(fake.connect).toHaveBeenCalledTimes(1);
    });

    it('a failed reopen is logged and a later access tries again', async () => {
        fake.connect.mockImplementationOnce(() => Promise.reject(new Error('boom')));
        simulateReconnectGaveUp(fake);

        await redisWrapper.reopenClosedClient();
        expect(mockedLogger.error).toHaveBeenCalledWith('❌ Redis client reopen failed:', expect.anything());

        void redisWrapper.client;
        expect(fake.connect).toHaveBeenCalledTimes(2);
        await redisWrapper.reopenClosedClient();
        expect(fake.isOpen).toBe(true);
    });

    it('intentionally closed client (quit/disconnect emitted end) is NOT reopened', async () => {
        fake.isOpen = false;
        fake.isReady = false;
        fake.handlers.end?.();

        void redisWrapper.client;
        await redisWrapper.reopenClosedClient();
        expect(fake.connect).not.toHaveBeenCalled();
    });

    it('healthy open client is left alone', async () => {
        void redisWrapper.client;
        await redisWrapper.reopenClosedClient();
        expect(fake.connect).not.toHaveBeenCalled();
    });
});
