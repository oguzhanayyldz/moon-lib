import axios, { AxiosError } from 'axios';
import http from 'http';
import { AddressInfo } from 'net';
import { Writable } from 'stream';
import winston from 'winston';
import { logger } from '../services/logger.service';
import { LOG_SERIALIZATION_ERROR, MAX_LOG_META_LENGTH, serializeLogMeta } from '../utils/logSafety.util';

// Fake values. They appear in source as `${...}` templates; the plaintext credential K0 gate
// (scripts/gates/lint_plaintext_credentials.py) treats them as placeholders.
const FAKE_BEARER = 'FAKE_BEARER_TOKEN';
const FAKE_API_KEY = 'FAKE_QUERY_KEY';
const FAKE_HEADER_KEY = 'FAKE_HEADER_KEY';
const FAKE_BODY_TOKEN = 'FAKE_BODY_TOKEN';
const FAKE_REQUEST_SECRET = 'FAKE_REQUEST_SECRET';
const SECRETS = [FAKE_BEARER, FAKE_API_KEY, FAKE_HEADER_KEY, FAKE_BODY_TOKEN, FAKE_REQUEST_SECRET];

const lines: string[] = [];
const capture = new winston.transports.Stream({
    stream: new Writable({
        write(chunk, _encoding, callback) {
            lines.push(chunk.toString());
            callback();
        }
    })
});

let server: http.Server;
let baseUrl: string;
let closedPortUrl: string;
const receivedAuthHeaders: Array<string | undefined> = [];

const expectNoSecret = (line: string) => {
    for (const secret of SECRETS) {
        expect(line).not.toContain(secret);
    }
    // Both markers start with `***`: `****` (maskErrorText) and `***REDACTED***` (redactSensitiveText).
    expect(line).not.toMatch(/Bearer (?!\*\*\*)/);
};

/** Logs through the real exported logger and returns the single line written by the winston transport. */
const logLine = (write: () => void): string => {
    lines.length = 0;
    expect(write).not.toThrow();
    expect(lines).toHaveLength(1);
    return lines[0];
};

const metaOf = (line: string): Record<string, any> => JSON.parse(line.slice(line.indexOf(' {') + 1));

/** A real AxiosError from a request to the local server (500 with a body holding a token). */
const requestFailing = async (): Promise<AxiosError> => {
    try {
        await axios.get(`${baseUrl}/v1/items?api_key=${FAKE_API_KEY}&page=2`, {
            headers: { Authorization: `Bearer ${FAKE_BEARER}`, 'X-Api-Key': FAKE_HEADER_KEY },
            data: { clientSecret: FAKE_REQUEST_SECRET }
        });
    } catch (error) {
        return error as AxiosError;
    }
    throw new Error('request was expected to fail');
};

const requestRefused = async (): Promise<AxiosError> => {
    try {
        await axios.post(`${closedPortUrl}/token?api_key=${FAKE_API_KEY}`, { clientSecret: FAKE_REQUEST_SECRET }, {
            headers: { Authorization: `Bearer ${FAKE_BEARER}` }
        });
    } catch (error) {
        return error as AxiosError;
    }
    throw new Error('request was expected to fail');
};

beforeAll(async () => {
    logger.transports.forEach((transport) => {
        transport.silent = true;
    });
    logger.add(capture);

    server = http.createServer((request, response) => {
        receivedAuthHeaders.push(request.headers.authorization);
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ token: FAKE_BODY_TOKEN, detail: 'upstream failure' }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const probe = http.createServer();
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
    closedPortUrl = `http://127.0.0.1:${(probe.address() as AddressInfo).port}`;
    await new Promise<void>((resolve) => probe.close(() => resolve()));
});

afterAll(async () => {
    logger.remove(capture);
    logger.transports.forEach((transport) => {
        transport.silent = false;
    });
    await new Promise<void>((resolve) => server.close(() => resolve()));
});

afterEach(() => {
    delete process.env.LOG_STACK;
});

describe('logger with a real AxiosError (test plan 1)', () => {
    it('logger.error(msg, err) with an HTTP 500 does not throw and keeps only whitelisted fields', async () => {
        const error = await requestFailing();
        // The secret really was sent: the test would otherwise pass for the wrong reason.
        expect(receivedAuthHeaders).toContain(`Bearer ${FAKE_BEARER}`);
        // The old printf threw here; the raw error is still circular.
        expect(() => JSON.stringify({ ...error })).toThrow(/circular/i);

        const line = logLine(() => logger.error('Trendyol request failed:', error));

        expectNoSecret(line);
        expect(line).toContain('Trendyol request failed: Request failed with status code 500');
        const meta = metaOf(line);
        expect(meta).toMatchObject({
            name: 'AxiosError',
            code: 'ERR_BAD_RESPONSE',
            status: 500,
            method: 'GET',
            url: `${baseUrl}/v1/items`
        });
        expect(Object.keys(meta).sort()).toEqual(['code', 'method', 'name', 'stack', 'status', 'url']);
        expect(line).not.toContain('api_key');
        expect(meta.stack).toMatch(/^AxiosError: Request failed with status code 500\n\s+at /);
    });

    it('logger.error(msg, err) with ECONNREFUSED keeps the code and drops the request body and headers', async () => {
        const error = await requestRefused();

        const line = logLine(() => logger.error('Token request failed:', error));

        expectNoSecret(line);
        expect(metaOf(line)).toMatchObject({ code: 'ECONNREFUSED', method: 'POST', url: `${closedPortUrl}/token` });
    });

    it('LOG_STACK=0 leaves the stack out', async () => {
        process.env.LOG_STACK = '0';
        const error = await requestFailing();

        const line = logLine(() => logger.error('Request failed:', error));

        expect(metaOf(line)).not.toHaveProperty('stack');
        expect(line).not.toContain('    at ');
    });

    it('logger.error(err) with the error as the only argument is reduced the same way', async () => {
        const error = await requestFailing();

        const line = logLine(() => logger.error(error as unknown as string));

        expectNoSecret(line);
        expect(line).toContain(': Request failed with status code 500 {');
        expect(metaOf(line)).toMatchObject({ status: 500, url: `${baseUrl}/v1/items` });
    });

    it('an unpacked copy of the error ({ ...err }) is reduced by its keys', async () => {
        const error = await requestFailing();

        const line = logLine(() => logger.error('Copied error:', { ...error, orderId: 'order-1' }));

        expectNoSecret(line);
        const meta = metaOf(line);
        expect(meta).toMatchObject({ orderId: 'order-1', status: 500, method: 'GET', url: `${baseUrl}/v1/items` });
        expect(meta).not.toHaveProperty('config');
        expect(meta).not.toHaveProperty('request');
    });

    it('an info object built from the error fields (no raw error in SPLAT) is reduced by its keys', async () => {
        const error = await requestFailing();

        const line = logLine(() => logger.log({ ...error, level: 'error', message: 'Info copy', orderId: 'order-1' }));

        expectNoSecret(line);
        expect(line).toContain(': Info copy {');
        expect(metaOf(line)).toMatchObject({ orderId: 'order-1', status: 500, method: 'GET', url: `${baseUrl}/v1/items` });
        expect(metaOf(line)).not.toHaveProperty('config');
    });

    it('leaves ordinary meta with config and request keys as it is', () => {
        const meta = { config: { retries: 3 }, request: { orderId: 'order-1' }, status: 'queued' };

        const line = logLine(() => logger.info('Queued', meta));

        expect(metaOf(line)).toEqual(meta);
    });

    it('masks a secret the error message carries in an address or a credential pair', () => {
        const error = new Error(`connect failed https://api.example.test/p?api_key=${FAKE_API_KEY}`);

        const line = logLine(() => logger.error('Connection failed:', error));

        expectNoSecret(line);
        expect(line).toContain('Connection failed: connect failed https://api.example.test/p?api_key=***REDACTED*** {');
        expect(metaOf(line).stack).toMatch(/^Error: connect failed https:\/\/api\.example\.test\/p\?api_key=\*\*\*REDACTED\*\*\*\n\s+at /);
    });

    it('masks an authorization header echoed into the error message', () => {
        const error = new Error(`upstream rejected Authorization: Bearer ${FAKE_BEARER} (401)`);

        const line = logLine(() => logger.error('Auth failed:', error));

        expectNoSecret(line);
        expect(line).toContain('Auth failed: upstream rejected Authorization: Bearer ***REDACTED*** (401) {');
    });
});

describe('logger with a nested error (test plan 2)', () => {
    it('{ error: err } does not write the request config that AxiosError.toJSON exposes', async () => {
        const error = await requestFailing();
        // The leak the logger has to close: toJSON carries the headers.
        expect(JSON.stringify({ error })).toContain(FAKE_BEARER);

        const line = logLine(() => logger.error('Request failed', { error, orderId: 'order-1' }));

        expectNoSecret(line);
        expect(metaOf(line)).toMatchObject({
            orderId: 'order-1',
            error: { name: 'AxiosError', status: 500, method: 'GET', url: `${baseUrl}/v1/items` }
        });
    });

    it('{ cause: err } and new Error(msg, { cause }) are reduced at every level', async () => {
        const error = await requestFailing();
        // The ES2022 Error options argument is not in this package's TS lib; the field is what matters.
        const wrapper = Object.assign(new Error('sync failed'), { cause: error });

        const nested = logLine(() => logger.warn('Retrying', { cause: error }));
        const wrapped = logLine(() => logger.error('Sync failed:', wrapper));

        expectNoSecret(nested);
        expectNoSecret(wrapped);
        expect(metaOf(nested).cause).toMatchObject({ status: 500 });
        expect(metaOf(wrapped).cause).toMatchObject({ name: 'AxiosError', status: 500, url: `${baseUrl}/v1/items` });
    });
});

describe('logger with circular and shared references (test plan 3)', () => {
    it('writes a cycle as [Circular]', () => {
        const node: Record<string, unknown> = { id: 1 };
        node.self = node;

        const line = logLine(() => logger.info('Cycle', { node }));

        expect(metaOf(line)).toEqual({ node: { id: 1, self: '[Circular]' } });
    });

    it('writes an object referenced twice without a cycle both times', () => {
        const shared = { x: 1 };

        const line = logLine(() => logger.info('Shared', { a: shared, b: shared, list: [shared, shared] }));

        expect(metaOf(line)).toEqual({ a: { x: 1 }, b: { x: 1 }, list: [{ x: 1 }, { x: 1 }] });
    });

    it('an error whose cause points back to itself does not loop', () => {
        process.env.LOG_STACK = '0';
        const error = new Error('loop') as Error & { cause?: unknown };
        error.cause = error;

        const line = logLine(() => logger.error('Loop:', error));

        expect(metaOf(line).cause.cause.cause).toMatchObject({ message: 'loop' });
        expect(metaOf(line).cause.cause.cause).not.toHaveProperty('cause');
    });
});

describe('logger with values JSON cannot write (test plan 4)', () => {
    it('writes bigint as a string, drops symbols and writes a Buffer as its length', () => {
        const line = logLine(() => logger.info('Values', { big: BigInt(10), sym: Symbol('s'), buffer: Buffer.alloc(3) }));

        expect(metaOf(line)).toEqual({ big: '10', buffer: '[Buffer 3 bytes]' });
    });

    it('a throwing toJSON or getter yields the serialization error marker instead of a throw', () => {
        const throwingToJson = { toJSON: () => { throw new Error('toJSON failed'); } };
        const throwingGetter = Object.defineProperty({}, 'value', {
            enumerable: true,
            get: () => { throw new Error('getter failed'); }
        });

        const first = logLine(() => logger.error('Bad meta', { item: throwingToJson }));
        const second = logLine(() => logger.error('Bad meta', { item: throwingGetter }));

        expect(first).toContain(`Bad meta ${LOG_SERIALIZATION_ERROR}`);
        expect(second).toContain(`Bad meta ${LOG_SERIALIZATION_ERROR}`);
    });
});

describe('logger output size (test plan 5)', () => {
    it('an error carrying a 10 MB response body writes a short line', () => {
        const error = new AxiosError('Request failed with status code 502', 'ERR_BAD_RESPONSE', { method: 'get', url: '/big' } as any, {}, {
            status: 502,
            data: 'x'.repeat(10 * 1024 * 1024)
        } as any);

        const line = logLine(() => logger.error('Big response:', error));

        expect(line.length).toBeLessThan(MAX_LOG_META_LENGTH);
        expect(metaOf(line)).toMatchObject({ status: 502, url: '/big' });
    });

    it('meta larger than the limit is cut and marked', () => {
        const serialized = serializeLogMeta({ data: 'y'.repeat(20000) });

        expect(serialized.length).toBeLessThan(MAX_LOG_META_LENGTH + 40);
        expect(serialized).toMatch(/…\[truncated \d+ chars\]$/);
    });
});

describe('serializeLogMeta', () => {
    it('keeps plain meta unchanged', () => {
        const meta = { orderId: 'o-1', count: 2, nested: { ok: true, list: [1, 'a', null] } };

        expect(serializeLogMeta(meta)).toBe(JSON.stringify(meta));
    });

    it('writes a plain Error with its message instead of {}', () => {
        expect(JSON.parse(serializeLogMeta({ error: new TypeError('bad input') })).error).toMatchObject({
            name: 'TypeError',
            message: 'bad input'
        });
    });
});

describe('logger with raw axios request parts', () => {
    it('{ config, response } of an AxiosError keeps only the request line and the status', async () => {
        const error = await requestFailing();

        const line = logLine(() => logger.error('Request failed', { config: error.config, response: error.response }));

        expectNoSecret(line);
        expect(metaOf(line)).toEqual({
            config: { method: 'GET', url: `${baseUrl}/v1/items` },
            response: { status: 500, method: 'GET', url: `${baseUrl}/v1/items` }
        });
    });

    it('AxiosError.toJSON() output does not write the request config', async () => {
        const error = await requestFailing();

        const line = logLine(() => logger.error('Request failed', error.toJSON() as Record<string, unknown>));

        expectNoSecret(line);
        expect(metaOf(line).config).toEqual({ method: 'GET', url: `${baseUrl}/v1/items` });
    });

    it('drops the userinfo of the request URL', () => {
        const error = Object.assign(new Error('Request failed'), {
            isAxiosError: true,
            config: { method: 'get', url: `https://merchant:${FAKE_API_KEY}@api.example.com/v1/items` }
        });

        const line = logLine(() => logger.error('Request failed:', error));

        expectNoSecret(line);
        expect(metaOf(line).url).toBe('https://****@api.example.com/v1/items');
    });
});
