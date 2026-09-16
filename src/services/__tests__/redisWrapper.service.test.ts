import { inspect } from 'util';
import { createClient } from 'redis';
import { redisWrapper } from '../redisWrapper.service';
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

// Fake value; the plaintext credential K0 gate treats `${...}` templates as placeholders.
const FAKE_PASSWORD = 'FAKE_PASSWORD';

type EventHandler = (payload?: unknown) => void;

interface FakeRedisClient {
    handlers: Record<string, EventHandler>;
    isOpen: boolean;
    on: jest.Mock;
    connect: jest.Mock;
    ping: jest.Mock;
    quit: jest.Mock;
}

const mockedCreateClient = createClient as unknown as jest.Mock;
const mockedLogger = jest.mocked(logger);

const createFakeClient = (): FakeRedisClient => {
    const client: FakeRedisClient = {
        handlers: {},
        isOpen: true,
        on: jest.fn(),
        connect: jest.fn().mockResolvedValue(undefined),
        ping: jest.fn().mockResolvedValue('PONG'),
        quit: jest.fn().mockResolvedValue('OK'),
    };
    client.on.mockImplementation((event: string, handler: EventHandler) => {
        client.handlers[event] = handler;
        return client;
    });
    return client;
};

// winston writes the error's message, stack and enumerable fields; showHidden sees the same.
const loggedText = () => inspect(
    [mockedLogger.info.mock.calls, mockedLogger.warn.mock.calls, mockedLogger.error.mock.calls],
    { depth: 8, showHidden: true }
);

const invalidUrlError = (): unknown => {
    try {
        new URL(`redis://:${FAKE_PASSWORD}/x@127.0.0.1:1`);
    } catch (error) {
        return error;
    }
    throw new Error('expected error was not thrown');
};

let urlCounter = 0;
const nextRedisUrl = () => {
    urlCounter += 1;
    return `redis://:${FAKE_PASSWORD}@redis-master-${urlCounter}:6379/0`;
};

describe('redisWrapper log safety', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(async () => {
        await redisWrapper.disconnect();
    });

    it('logs the masked URL while connecting, after connecting and on the connect event', async () => {
        const client = createFakeClient();
        mockedCreateClient.mockReturnValue(client);
        const url = nextRedisUrl();

        await redisWrapper.connect(url, 1000);
        client.handlers.connect();

        const masked = url.replace(FAKE_PASSWORD, '****');
        expect(mockedCreateClient).toHaveBeenCalledWith(expect.objectContaining({ url }));
        expect(mockedLogger.info).toHaveBeenCalledWith(`Connecting to Redis at ${masked} with 1000ms timeout...`);
        expect(mockedLogger.info).toHaveBeenCalledWith(`✅ Successfully connected to Redis at ${masked}`);
        expect(mockedLogger.info).toHaveBeenCalledWith(`✅ Redis Client Connected to ${masked}`);
        expect(loggedText()).not.toContain(FAKE_PASSWORD);
    });

    it('logs the masked URL when reusing an existing connection', async () => {
        const client = createFakeClient();
        mockedCreateClient.mockReturnValue(client);
        const url = nextRedisUrl();

        await redisWrapper.connect(url, 1000);
        await redisWrapper.connect(url, 1000);

        expect(mockedCreateClient).toHaveBeenCalledTimes(1);
        expect(mockedLogger.info).toHaveBeenCalledWith(`Reusing existing Redis connection to ${url.replace(FAKE_PASSWORD, '****')}`);
        expect(loggedText()).not.toContain(FAKE_PASSWORD);
    });

    it('logs only safe fields instead of the raw error on the error event', async () => {
        const client = createFakeClient();
        mockedCreateClient.mockReturnValue(client);
        await redisWrapper.connect(nextRedisUrl(), 1000);

        client.handlers.error(invalidUrlError());

        expect(mockedLogger.error).toHaveBeenCalledWith(
            '❌ Redis Client Error:',
            { name: 'TypeError', code: 'ERR_INVALID_URL', message: 'Invalid URL', input: 'redis://****' }
        );
        expect(loggedText()).not.toContain(FAKE_PASSWORD);
    });

    it('rejects with a sanitized error (not the raw one) for an invalid URL, preserving the code', async () => {
        const error = invalidUrlError();
        mockedCreateClient.mockImplementation(() => {
            throw error;
        });

        const rejected = await redisWrapper.connect(`redis://:${FAKE_PASSWORD}/x@127.0.0.1:1`, 1000).catch((e) => e);

        expect(rejected).not.toBe(error);
        expect(rejected).toMatchObject({ name: 'TypeError', code: 'ERR_INVALID_URL', message: 'Invalid URL' });
        expect(rejected).not.toHaveProperty('cause');
        expect(inspect(rejected, { depth: 8, showHidden: true })).not.toContain(FAKE_PASSWORD);
        expect(mockedLogger.error).toHaveBeenCalledWith(
            '❌ Failed to connect to Redis:',
            expect.objectContaining({ code: 'ERR_INVALID_URL', input: 'redis://****' })
        );
        expect(loggedText()).not.toContain(FAKE_PASSWORD);
    });

    it('logs sanitized error objects when connect and cleanup both fail, and rejects with a sanitized error', async () => {
        const client = createFakeClient();
        const connectError = Object.assign(new Error(`connect failed redis://:${FAKE_PASSWORD}@redis-master:6379`), { code: 'ECONNREFUSED' });
        client.connect.mockRejectedValue(connectError);
        client.quit.mockRejectedValue(new Error(`quit failed for redis://:${FAKE_PASSWORD}@redis-master:6379`));
        mockedCreateClient.mockReturnValue(client);

        const rejected = await redisWrapper.connect(nextRedisUrl(), 1000).catch((e) => e);

        expect(rejected).not.toBe(connectError);
        expect(rejected).toMatchObject({ code: 'ECONNREFUSED', message: 'connect failed redis://:****@redis-master:6379' });
        expect(rejected).not.toHaveProperty('cause');
        expect(inspect(rejected, { depth: 8, showHidden: true })).not.toContain(FAKE_PASSWORD);
        expect(mockedLogger.warn).toHaveBeenCalledWith(
            'Failed to quit client during cleanup:',
            expect.objectContaining({ message: 'quit failed for redis://:****@redis-master:6379' })
        );
        expect(mockedLogger.error).toHaveBeenCalledWith(
            '❌ Failed to connect to Redis:',
            expect.objectContaining({ code: 'ECONNREFUSED', message: 'connect failed redis://:****@redis-master:6379' })
        );
        expect(loggedText()).not.toContain(FAKE_PASSWORD);
    });

    it('logs a sanitized async error raised during connect and rejects with a sanitized error', async () => {
        const client = createFakeClient();
        const asyncError = invalidUrlError();
        client.connect.mockImplementation(async () => {
            client.handlers.error(asyncError);
        });
        mockedCreateClient.mockReturnValue(client);

        const rejected = await redisWrapper.connect(nextRedisUrl(), 1000).catch((e) => e);

        expect(rejected).not.toBe(asyncError);
        expect(rejected).toMatchObject({ name: 'TypeError', code: 'ERR_INVALID_URL', message: 'Invalid URL' });
        expect(rejected).not.toHaveProperty('cause');
        expect(inspect(rejected, { depth: 8, showHidden: true })).not.toContain(FAKE_PASSWORD);

        const safeError = { name: 'TypeError', code: 'ERR_INVALID_URL', message: 'Invalid URL', input: 'redis://****' };
        expect(mockedLogger.error).toHaveBeenCalledWith('❌ Redis Client Error:', safeError);
        expect(mockedLogger.error).toHaveBeenCalledWith('❌ Async connection error detected:', safeError);
        expect(mockedLogger.error).toHaveBeenCalledWith('❌ Failed to connect to Redis:', safeError);
        expect(loggedText()).not.toContain(FAKE_PASSWORD);
    });

    it('returns the masked URL from getConnectionStats, never the raw one', async () => {
        const client = createFakeClient();
        mockedCreateClient.mockReturnValue(client);
        const url = nextRedisUrl();

        await redisWrapper.connect(url, 1000);

        const stats = redisWrapper.getConnectionStats();
        expect(stats.currentUrl).toBe(url.replace(FAKE_PASSWORD, '****'));
        expect(stats.currentUrl).not.toContain(FAKE_PASSWORD);
    });
});
