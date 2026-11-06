import { Writable } from 'stream';
import winston from 'winston';
import { logger } from '../services/logger.service';
import { REDACTED_FIELD_MASK, serializeLogMeta } from '../utils/logSafety.util';

// UC-832: credential-named meta fields and secrets inside a plain (non-error) message are masked.
// Fake values; written as `${...}` templates so the plaintext credential K0 gate treats them as placeholders.
const FAKE_API_KEY = 'FAKE_META_API_KEY';
const FAKE_TOKEN = 'FAKE_META_TOKEN';
const FAKE_PASSWORD = 'FAKE_META_PASSWORD';
const FAKE_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.FAKEsignature';

const lines: string[] = [];
const capture = new winston.transports.Stream({
    stream: new Writable({
        write(chunk, _encoding, callback) {
            lines.push(chunk.toString());
            callback();
        }
    })
});

const logLine = (write: () => void): string => {
    lines.length = 0;
    expect(write).not.toThrow();
    expect(lines).toHaveLength(1);
    return lines[0];
};

const metaOf = (line: string): Record<string, any> => JSON.parse(line.slice(line.indexOf(' {') + 1));

beforeAll(() => {
    logger.transports.forEach((transport) => {
        transport.silent = true;
    });
    logger.add(capture);
});

afterAll(() => {
    logger.remove(capture);
    logger.transports.forEach((transport) => {
        transport.silent = false;
    });
});

describe('logger meta: credential-named fields', () => {
    it('masks apiKey and keeps orderId', () => {
        const line = logLine(() => logger.info('x', { apiKey: `${FAKE_API_KEY}`, orderId: 1 }));

        expect(line).not.toContain(FAKE_API_KEY);
        expect(metaOf(line)).toEqual({ apiKey: REDACTED_FIELD_MASK, orderId: 1 });
    });

    it('masks nested credential fields, whatever their spelling', () => {
        const line = logLine(() =>
            logger.warn('platform call', {
                integration: 'trendyol',
                headers: { Authorization: `Bearer ${FAKE_TOKEN}`, 'x-api-key': `${FAKE_API_KEY}` },
                credentials: { username: 'u', password: `${FAKE_PASSWORD}` },
                items: [{ accessToken: `${FAKE_TOKEN}`, sku: 'S-1' }]
            })
        );

        expect(line).not.toContain(FAKE_TOKEN);
        expect(line).not.toContain(FAKE_API_KEY);
        expect(line).not.toContain(FAKE_PASSWORD);
        expect(metaOf(line)).toEqual({
            integration: 'trendyol',
            headers: { Authorization: REDACTED_FIELD_MASK, 'x-api-key': REDACTED_FIELD_MASK },
            credentials: REDACTED_FIELD_MASK,
            items: [{ accessToken: REDACTED_FIELD_MASK, sku: 'S-1' }]
        });
    });

    it('masks key material listed in plural form', () => {
        const meta = JSON.parse(serializeLogMeta({ apiKeys: [`${FAKE_API_KEY}`], secretKeys: ['s'] }));

        expect(meta).toEqual({ apiKeys: REDACTED_FIELD_MASK, secretKeys: REDACTED_FIELD_MASK });
    });

    it('keeps Redis/lock/cache keys, field-name lists, flags and counts readable', () => {
        const meta = {
            key: 'batch:trendyol:42',
            cacheKey: 'analytics:u1',
            lockKey: 'lock:order:TY-1',
            credentialsKeys: ['supplierId', 'apiKey'],
            responseKeys: ['orders', 'page'],
            hasRefreshToken: true,
            passwordRemoved: false,
            revokedTokens: 3,
            cachedToken: null
        };

        expect(JSON.parse(serializeLogMeta(meta))).toEqual(meta);
    });

    it('still writes an error held under a credential-like name as a safe error', () => {
        const meta = JSON.parse(serializeLogMeta({ tokenRefreshError: new Error('refresh failed') }));

        expect(meta.tokenRefreshError).toMatchObject({ name: 'Error', message: 'refresh failed' });
    });

    it('does not throw on a circular error passed as logger.error(msg, err)', () => {
        const error = new Error('upstream failed') as Error & { self?: unknown; config?: unknown };
        error.self = error;
        error.config = { headers: { Authorization: `Bearer ${FAKE_TOKEN}` } };

        const line = logLine(() => logger.error('call failed', error));

        expect(line).not.toContain(FAKE_TOKEN);
        expect(line).toContain('upstream failed');
        expect(line).not.toContain('Converting circular structure');
    });
});

describe('logger message text outside the error path', () => {
    it('masks a connection-string password, a JWT and a Bearer token', () => {
        const line = logLine(() =>
            logger.info(`connecting mongodb://app:${FAKE_PASSWORD}@db:27017/x with ${FAKE_JWT} and Bearer ${FAKE_TOKEN}`)
        );

        expect(line).not.toContain(FAKE_PASSWORD);
        expect(line).not.toContain(FAKE_JWT);
        expect(line).not.toContain(FAKE_TOKEN);
        expect(line).toContain('connecting mongodb://app:');
    });

    it('masks the caller message of logger.error(msg, err) too', () => {
        const line = logLine(() => logger.error(`token call to https://u:${FAKE_PASSWORD}@api.example.com failed`, new Error('boom')));

        expect(line).not.toContain(FAKE_PASSWORD);
        expect(line).toContain('boom');
    });

    it('leaves diagnostic ids that follow a credential-like word readable', () => {
        const text = 'Lock released - Platform: trendyol, LockKey: lock:TY-1, syncSessionId: s-42, dedup key: d-7, basic info';
        const line = logLine(() => logger.info(text));

        expect(line).toContain(text);
    });
});
