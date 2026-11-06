import { createClient } from 'redis';
import { getRedisStartupRetryDelay, redisWrapper, resolveRedisStartupMaxWaitMs } from '../redisWrapper.service';
import { logger } from '../logger.service';

jest.mock('redis', () => ({
    createClient: jest.fn()
}));

jest.mock('../logger.service', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    }
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

const refused = () => Object.assign(new Error('connect ECONNREFUSED 10.43.0.10:6379'), { code: 'ECONNREFUSED' });

const createFakeClient = (fails: boolean): FakeRedisClient => {
    const client: FakeRedisClient = {
        handlers: {},
        isOpen: true,
        isReady: !fails,
        on: jest.fn(),
        connect: fails ? jest.fn().mockRejectedValue(refused()) : jest.fn().mockResolvedValue(undefined),
        ping: jest.fn().mockResolvedValue('PONG'),
        quit: jest.fn().mockResolvedValue('OK'),
        disconnect: jest.fn().mockResolvedValue(undefined),
    };
    client.on.mockImplementation((event: string, handler: EventHandler) => {
        client.handlers[event] = handler;
        return client;
    });
    return client;
};

/** Sırayla verilen sonuçlara göre istemci üretir (true = bağlanamaz). */
const queueClients = (outcomes: boolean[]): FakeRedisClient[] => {
    const clients = outcomes.map(createFakeClient);
    clients.forEach(client => mockedCreateClient.mockReturnValueOnce(client));
    return clients;
};

let urlCounter = 0;
const nextRedisUrl = () => `redis://redis-startup-${++urlCounter}:6379/0`;

/** connect()'i başlatır, sahte zamanı adım adım ilerletir ve sonucu döndürür. */
const runConnect = async (url: string, advanceMs: number) => {
    const outcome = redisWrapper.connect(url, 1000).then(() => 'resolved', (e) => e);
    for (let elapsed = 0; elapsed < advanceMs; elapsed += 250) {
        await jest.advanceTimersByTimeAsync(250);
    }
    return outcome;
};

describe('redisWrapper startup retry (UC-1043)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedCreateClient.mockReset();
        jest.useFakeTimers();
        delete process.env.REDIS_STARTUP_MAX_WAIT_MS;
        // Her test bu sürecin ilk açılışıdır
        (redisWrapper as any).hasConnected = false;
    });

    afterEach(async () => {
        jest.useRealTimers();
        await redisWrapper.disconnect();
        delete process.env.REDIS_STARTUP_MAX_WAIT_MS;
    });

    it('backoff: 1, 2, 4, 8, 16 s then capped at 30 s', () => {
        expect([1, 2, 3, 4, 5, 6, 7, 20].map(getRedisStartupRetryDelay))
            .toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
    });

    it.each([
        [undefined, -1],
        ['', -1],
        ['abc', -1],
        ['-5', -1],
        ['1.5', -1],
        ['0', 0],
        ['60000', 60000],
    ])('REDIS_STARTUP_MAX_WAIT_MS=%p → %p', (raw, expected) => {
        if (raw === undefined) delete process.env.REDIS_STARTUP_MAX_WAIT_MS;
        else process.env.REDIS_STARTUP_MAX_WAIT_MS = raw;
        expect(resolveRedisStartupMaxWaitMs()).toBe(expected);
    });

    it('Redis comes up late at startup: retries with backoff and connects (no env = unlimited)', async () => {
        const clients = queueClients([true, true, true, false]);
        const url = nextRedisUrl();

        const result = await runConnect(url, 1000 + 2000 + 4000 + 500);

        expect(result).toBe('resolved');
        expect(mockedCreateClient).toHaveBeenCalledTimes(4);
        expect(redisWrapper.client).toBe(clients[3]);
        // Başarısız her deneme kendi istemcisini durdurur: arkada yeniden bağlanan istemci kalmaz
        clients.slice(0, 3).forEach(client => {
            expect(client.disconnect).toHaveBeenCalledTimes(1);
            expect(client.quit).not.toHaveBeenCalled();
        });
        const retryLogs = mockedLogger.warn.mock.calls.map(c => String(c[0])).filter(m => m.startsWith('Redis not reachable at startup'));
        expect(retryLogs).toHaveLength(3);
        expect(retryLogs[0]).toContain('retrying in 1000ms');
        expect(retryLogs[1]).toContain('retrying in 2000ms');
        expect(retryLogs[2]).toContain('retrying in 4000ms');
    });

    it('does not resolve before Redis is reachable (the service keeps HTTP closed meanwhile)', async () => {
        mockedCreateClient.mockImplementation(() => createFakeClient(true));
        let settled = false;
        const pending = redisWrapper.connect(nextRedisUrl(), 1000).then(() => { settled = true; }, () => { settled = true; });

        for (let i = 0; i < 40; i++) {
            await jest.advanceTimersByTimeAsync(5000);
        }

        expect(settled).toBe(false);
        expect(mockedCreateClient.mock.calls.length).toBeGreaterThanOrEqual(8);

        // Redis gelince toparlanır
        mockedCreateClient.mockImplementation(() => createFakeClient(false));
        await jest.advanceTimersByTimeAsync(31000);
        await pending;
        expect(settled).toBe(true);
        expect(() => redisWrapper.client).not.toThrow();
    });

    it('REDIS_STARTUP_MAX_WAIT_MS=0 keeps the old single attempt', async () => {
        process.env.REDIS_STARTUP_MAX_WAIT_MS = '0';
        queueClients([true, false]);

        const result = await runConnect(nextRedisUrl(), 3000);

        expect(result).toMatchObject({ code: 'ECONNREFUSED' });
        expect(mockedCreateClient).toHaveBeenCalledTimes(1);
    });

    it('REDIS_STARTUP_MAX_WAIT_MS caps the total wait', async () => {
        process.env.REDIS_STARTUP_MAX_WAIT_MS = '2500';
        queueClients([true, true, false]);

        // Deneme 1 → 1 sn bekle (1000 ≤ 2500), deneme 2 → 1000 + 2000 > 2500: vazgeç
        const result = await runConnect(nextRedisUrl(), 6000);

        expect(result).toMatchObject({ code: 'ECONNREFUSED' });
        expect(mockedCreateClient).toHaveBeenCalledTimes(2);
    });

    it('a configuration error (invalid URL → TypeError) is not retried', async () => {
        const invalid = Object.assign(new TypeError('Invalid URL'), { code: 'ERR_INVALID_URL' });
        mockedCreateClient.mockImplementation(() => { throw invalid; });

        const result = await runConnect(nextRedisUrl(), 5000);

        expect(result).toMatchObject({ name: 'TypeError', code: 'ERR_INVALID_URL' });
        expect(mockedCreateClient).toHaveBeenCalledTimes(1);
    });

    it('a runtime reconnect after a successful startup stays a single attempt', async () => {
        queueClients([false]);
        await runConnect(nextRedisUrl(), 0);
        await redisWrapper.disconnect();

        queueClients([true, false]);
        const result = await runConnect(nextRedisUrl(), 5000);

        expect(result).toMatchObject({ code: 'ECONNREFUSED' });
        expect(mockedCreateClient).toHaveBeenCalledTimes(2);
    });
});
