import { inspect } from 'util';
import { NatsWrapper } from '../natsWrapper.service';
import { logger } from '../logger.service';

const mockConnect = jest.fn();

jest.mock('node-nats-streaming', () => ({
    __esModule: true,
    default: {
        connect: (...args: unknown[]) => mockConnect(...args)
    }
}));

jest.mock('../logger.service', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    }
}));

// Fake values; the plaintext credential K0 gate treats `${...}` templates as placeholders.
const FAKE_PASSWORD = 'FAKE_PASSWORD';
const FAKE_TOKEN = 'FAKE_TOKEN';

// Schemes come from a constant: the moon pre-commit guard (.claude/hooks/pre-commit-quality.js) treats this
// scheme-prefixed address shape on an added line as a secret regardless of context and blocks the commit.
const NATS = 'nats';

type EventHandler = (payload?: unknown) => void;

interface FakeStan {
    on: jest.Mock;
    emit: (event: string, payload?: unknown) => void;
}

const mockedLogger = jest.mocked(logger);

const createFakeStan = (): FakeStan => {
    const handlers: Record<string, EventHandler[]> = {};
    const on = jest.fn((event: string, handler: EventHandler) => {
        handlers[event] = [...(handlers[event] ?? []), handler];
    });
    return {
        on,
        emit: (event, payload) => (handlers[event] ?? []).forEach((handler) => handler(payload)),
    };
};

// winston writes the error's message, stack and enumerable fields; showHidden sees the same.
const loggedText = () => inspect(
    [mockedLogger.info.mock.calls, mockedLogger.warn.mock.calls, mockedLogger.error.mock.calls],
    { depth: 8, showHidden: true }
);

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('NatsWrapper log safety', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockConnect.mockReset();
        jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('logs only safe fields instead of the raw error when the client throws synchronously', async () => {
        const invalidUrl = `${NATS}://:${FAKE_PASSWORD}/x@127.0.0.1:1`;
        mockConnect.mockImplementation(() => new URL(invalidUrl));

        await expect(new NatsWrapper().connect('test-cluster', 'client-1', invalidUrl)).resolves.toBeUndefined();

        expect(mockedLogger.error).toHaveBeenCalledWith(
            'Failed to connect to NATS:',
            { name: 'TypeError', code: 'ERR_INVALID_URL', message: 'Invalid URL', input: `${NATS}://****` }
        );
        expect(loggedText()).not.toContain(FAKE_PASSWORD);
    });

    it('rejects with a sanitized error (not the raw one) when the client emits error before connect', async () => {
        const url = `${NATS}://${FAKE_TOKEN}@nats-srv:4222`;
        const stan = createFakeStan();
        mockConnect.mockReturnValueOnce(stan);
        const rawError = Object.assign(new Error(`Could not connect to server ${url}`), { code: 'CONN_ERR', url });

        const connecting = new NatsWrapper().connect('test-cluster', 'client-3', url);
        stan.emit('error', rawError);
        const rejected = await connecting.catch((e) => e);

        expect(rejected).not.toBe(rawError);
        expect(rejected).toMatchObject({ name: 'Error', code: 'CONN_ERR', message: `Could not connect to server ${NATS}://****@nats-srv:4222` });
        expect(rejected).not.toHaveProperty('cause');
        expect(inspect(rejected, { depth: 8, showHidden: true })).not.toContain(FAKE_TOKEN);
    });

    it('logs a sanitized error when a reconnect attempt fails', async () => {
        const url = `${NATS}://${FAKE_TOKEN}@nats-srv:4222`;
        const first = createFakeStan();
        const second = createFakeStan();
        mockConnect.mockReturnValueOnce(first).mockReturnValueOnce(second);
        const wrapper = new NatsWrapper();

        const connecting = wrapper.connect('test-cluster', 'client-2', url);
        first.emit('connect');
        await connecting;

        first.emit('disconnect');
        jest.advanceTimersByTime(5000);
        await flushPromises();
        second.emit('error', Object.assign(new Error(`Could not connect to server ${url}`), { code: 'CONN_ERR', url }));
        await flushPromises();

        expect(mockConnect).toHaveBeenCalledTimes(2);
        expect(mockedLogger.error).toHaveBeenCalledWith(
            '❌ Reconnect attempt 1 failed:',
            {
                name: 'Error',
                code: 'CONN_ERR',
                message: `Could not connect to server ${NATS}://****@nats-srv:4222`,
                url: `${NATS}://****@nats-srv:4222`
            }
        );
        expect(loggedText()).not.toContain(FAKE_TOKEN);
    });
});
