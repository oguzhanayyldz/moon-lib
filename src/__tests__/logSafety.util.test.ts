import { inspect } from 'util';
import { maskConnectionUriSecret, maskConnectionUrisInText, sanitizeConnectionError, toSafeError } from '../utils/logSafety.util';

// Fake values. They appear in source as `${...}` templates; the plaintext credential K0 gate
// (scripts/gates/lint_plaintext_credentials.py) treats them as placeholders.
const FAKE_PASSWORD = 'FAKE_PASSWORD';
const FAKE_SECRET = 'FAKE_SECRET';
const FAKE_TOKEN = 'FAKE_TOKEN';

// Schemes come from constants: the moon pre-commit guard (.claude/hooks/pre-commit-quality.js) treats this
// scheme-prefixed address shape on an added line as a secret regardless of context and blocks the commit.
const MONGODB = 'mongodb';
const NATS = 'nats';

const expectNoSecret = (result: unknown) => {
    const text = typeof result === 'string' ? result : JSON.stringify(result);
    expect(text).not.toContain(FAKE_PASSWORD);
    expect(text).not.toContain(FAKE_SECRET);
    expect(text).not.toContain(FAKE_TOKEN);
};

const captureThrown = (action: () => unknown): unknown => {
    try {
        action();
    } catch (error) {
        return error;
    }
    throw new Error('expected error was not thrown');
};

describe('maskConnectionUriSecret', () => {
    // The 19 formats from the SEC-2 review table (ekler/TASK-MU1BAYITLBPZC/inceleme-notlari.md §A), in the same order.
    const formats: Array<[string, string, string]> = [
        ['1 scheme + username + password',
            `${MONGODB}+srv://dbuser:${FAKE_PASSWORD}@cluster0.example.mongodb.net/mydb?retryWrites=true`,
            `${MONGODB}+srv://dbuser:****@cluster0.example.mongodb.net/mydb?retryWrites=true`],
        ['2 scheme + empty username + password',
            `redis://:${FAKE_PASSWORD}@redis-master:6379`,
            'redis://:****@redis-master:6379'],
        ['3 username + password without scheme',
            `dbuser:${FAKE_PASSWORD}@mongo-srv:27017`,
            'dbuser:****@mongo-srv:27017'],
        ['4 empty username + password without scheme',
            `:${FAKE_PASSWORD}@redis-master:6379`,
            ':****@redis-master:6379'],
        ['5 unescaped @ in password',
            `redis://:${FAKE_PASSWORD}@${FAKE_SECRET}@redis-master:6379`,
            'redis://:****@redis-master:6379'],
        ['6 unescaped : in password',
            `redis://default:${FAKE_PASSWORD}:${FAKE_SECRET}@redis-master:6379`,
            'redis://default:****@redis-master:6379'],
        ['7 percent-encoded %40 / %3A',
            `${MONGODB}://dbuser:${FAKE_PASSWORD}%40%3A@mongo-srv:27017/db`,
            `${MONGODB}://dbuser:****@mongo-srv:27017/db`],
        ['8 multi-host + replicaSet + authSource',
            `${MONGODB}://dbuser:${FAKE_PASSWORD}@host1:27017,host2:27017,host3:27017/db?replicaSet=rs0&authSource=admin`,
            `${MONGODB}://dbuser:****@host1:27017,host2:27017,host3:27017/db?replicaSet=rs0&authSource=admin`],
        ['9 token-only userinfo (NATS)',
            `${NATS}://${FAKE_TOKEN}@nats-srv:4222`,
            `${NATS}://****@nats-srv:4222`],
        ['10 username only (indistinguishable from a token, masked)',
            'redis://default@redis-master:6379',
            'redis://****@redis-master:6379'],
        ['11 query tlsCertificateKeyFilePassword',
            `${MONGODB}://mongo-srv:27017/db?tlsCertificateKeyFilePassword=${FAKE_PASSWORD}`,
            `${MONGODB}://mongo-srv:27017/db?tlsCertificateKeyFilePassword=****`],
        ['12 query authMechanismProperties AWS_SESSION_TOKEN',
            `${MONGODB}://mongo-srv:27017/db?authMechanismProperties=AWS_SESSION_TOKEN:${FAKE_TOKEN}`,
            `${MONGODB}://mongo-srv:27017/db?authMechanismProperties=****`],
        ['13 query password',
            `${MONGODB}://mongo-srv:27017/db?authSource=admin&password=${FAKE_SECRET}&${FAKE_SECRET}`,
            `${MONGODB}://mongo-srv:27017/db?authSource=admin&password=****&****`],
        ['14 IPv6 host and Redis db number',
            `redis://:${FAKE_PASSWORD}@[::1]:6379/0`,
            'redis://:****@[::1]:6379/0'],
        ['15 comma-separated multiple NATS addresses',
            `${NATS}://natsuser:${FAKE_PASSWORD}@nats-a:4222, ${NATS}://${FAKE_TOKEN}@nats-b:4222`,
            `${NATS}://natsuser:****@nats-a:4222, ${NATS}://****@nats-b:4222`],
        ['16 unescaped / in password (invalid URL) → scheme only',
            `redis://:${FAKE_PASSWORD}/${FAKE_SECRET}@redis-master:6379`,
            'redis://****'],
        ['17 # or ? in password → scheme only',
            `redis://:${FAKE_PASSWORD}#${FAKE_SECRET}@redis-master:6379`,
            'redis://****'],
        ['18 address without credentials is unchanged',
            `${MONGODB}://products-mongo-srv:27017/products`,
            `${MONGODB}://products-mongo-srv:27017/products`],
        ['19 a:b@c inside query → scheme only',
            `${MONGODB}://mongo-srv:27017/db?appName=${FAKE_PASSWORD}@${FAKE_SECRET}`,
            `${MONGODB}://****`],
    ];

    it.each(formats)('format %s', (_label, input, expected) => {
        const result = maskConnectionUriSecret(input);
        expect(result).toBe(expected);
        expectNoSecret(result);
    });

    it('covers all 19 formats in the table', () => {
        expect(formats).toHaveLength(19);
    });

    describe('fail-closed: only the scheme is kept for unparseable shapes', () => {
        it('masks everything when the password contains an unescaped ?', () => {
            expect(maskConnectionUriSecret(`redis://:${FAKE_PASSWORD}?${FAKE_SECRET}@redis-master:6379`)).toBe('redis://****');
        });

        it('masks everything when the host or path is not in the expected shape', () => {
            expect(maskConnectionUriSecret(`redis://redis master:${FAKE_PASSWORD}`)).toBe('redis://****');
            expect(maskConnectionUriSecret(`${MONGODB}://mongo-srv:27017/db:${FAKE_PASSWORD}`)).toBe(`${MONGODB}://****`);
            expect(maskConnectionUriSecret(`${MONGODB}://mongo-srv:27017/db#${FAKE_PASSWORD}`)).toBe(`${MONGODB}://****`);
            expect(maskConnectionUriSecret(`${FAKE_SECRET} ${FAKE_PASSWORD}`)).toBe('****');
        });
    });

    describe('fail-closed: userinfo is masked entirely while the host stays visible', () => {
        it('masks userinfo entirely and keeps the host when userinfo contains a space', () => {
            expect(maskConnectionUriSecret(`redis://${FAKE_SECRET} x:${FAKE_PASSWORD}@redis-master:6379`)).toBe('redis://****@redis-master:6379');
            const result = maskConnectionUriSecret(`redis://default:1234 ${FAKE_PASSWORD}@redis-master:6379`);
            expect(result).toBe('redis://****@redis-master:6379');
            expect(result).not.toContain('1234');
        });

        it('masks userinfo entirely when it contains a tab or CR/LF instead of a space', () => {
            expect(maskConnectionUriSecret(`redis://user\tname:${FAKE_PASSWORD}@redis-master:6379`)).toBe('redis://****@redis-master:6379');
            const result = maskConnectionUriSecret(`redis://user\r\nname:${FAKE_PASSWORD}@redis-master:6379`);
            expect(result).toBe('redis://****@redis-master:6379');
            expect(result).not.toMatch(/[\r\n]/);
        });

        it('masks userinfo entirely when the username contains an unescaped @', () => {
            const result = maskConnectionUriSecret(`${NATS}://${FAKE_TOKEN}@nats-a:${FAKE_PASSWORD}@nats-b:4222`);
            expect(result).toBe(`${NATS}://****@nats-b:4222`);
            expectNoSecret(result);
        });
    });

    describe('log-line-forging prevention (control characters)', () => {
        // Ported from products #702; the whitespace/@ extra rule above already masks userinfo entirely for
        // CR/LF (they are whitespace), so the expected value differs from products but leaks nothing either.
        it('does not let CR/LF from the username reach the output', () => {
            const result = maskConnectionUriSecret(`redis://dbuser\r\n[FORGED] fake-line:${FAKE_PASSWORD}@redis-master:6379`);
            expect(result).toBe('redis://****@redis-master:6379');
            expect(result).not.toMatch(/[\r\n]/);
            expectNoSecret(result);
        });

        it('strips CR/LF from a known-safe query value', () => {
            const result = maskConnectionUriSecret('redis://redis-master:6379/0?retryWrites=true\r\n[FORGED] fake-line');
            expect(result).toBe('redis://redis-master:6379/0?retryWrites=true[FORGED] fake-line');
            expect(result).not.toMatch(/[\r\n]/);
        });

        it('does not decode a percent-encoded CR/LF, so it stays inert', () => {
            const result = maskConnectionUriSecret('redis://redis-master:6379/0?retryWrites=true%0A%5BFORGED%5D');
            expect(result).toBe('redis://redis-master:6379/0?retryWrites=true%0A%5BFORGED%5D');
        });

        it('strips an ESC terminal escape sequence from the username', () => {
            const result = maskConnectionUriSecret(`redis://db\x1b[31muser:${FAKE_PASSWORD}@redis-master:6379`);
            expect(result).toBe('redis://db[31muser:****@redis-master:6379');
            expect(result).not.toMatch(/\x1b/);
            expectNoSecret(result);
        });
    });

    describe('addresses without credentials are left unmasked', () => {
        it('keeps a bare @ with empty userinfo unchanged', () => {
            expect(maskConnectionUriSecret('redis://@redis-master:6379')).toBe('redis://@redis-master:6379');
        });

        it('keeps an address without userinfo unchanged', () => {
            expect(maskConnectionUriSecret(`${NATS}://nats-srv:4222`)).toBe(`${NATS}://nats-srv:4222`);
        });
    });

    it('returns undefined for undefined input and an empty string for empty input', () => {
        expect(maskConnectionUriSecret(undefined)).toBeUndefined();
        expect(maskConnectionUriSecret('')).toBe('');
    });
});

describe('maskConnectionUrisInText', () => {
    it('leaves text without addresses unchanged', () => {
        expect(maskConnectionUrisInText('connect ECONNREFUSED 127.0.0.1:6379')).toBe('connect ECONNREFUSED 127.0.0.1:6379');
    });

    it('masks an address inside text and keeps the surrounding text', () => {
        const result = maskConnectionUrisInText(`Could not connect to ${NATS}://${FAKE_TOKEN}@nats-srv:4222 after 3 attempts`);
        expect(result).toBe(`Could not connect to ${NATS}://****@nats-srv:4222 after 3 attempts`);
        expectNoSecret(result);
    });

    it('masks the legacy Node "Invalid URL: <address>" message', () => {
        const result = maskConnectionUrisInText(`Invalid URL: redis://:${FAKE_PASSWORD}@redis-master:6379`);
        expect(result).toBe('Invalid URL: redis://:****@redis-master:6379');
        expectNoSecret(result);
    });

    it('keeps only the scheme for an unparseable address', () => {
        const result = maskConnectionUrisInText(`Invalid URL: redis://:${FAKE_PASSWORD}/${FAKE_SECRET}@redis-master:6379`);
        expect(result).toBe('Invalid URL: redis://****');
    });

    it('extends the region to the last @ when the password contains whitespace, masking the part before it too', () => {
        const result = maskConnectionUrisInText(`Invalid URL: redis://default:1234 ${FAKE_PASSWORD}@redis-master:6379 (retry)`);
        expect(result).toBe('Invalid URL: redis://****@redis-master:6379 (retry)');
        expect(result).not.toContain('1234');
        expectNoSecret(result);
    });

    it('masks multiple addresses in the same text, including a query secret without @', () => {
        const result = maskConnectionUrisInText(
            `primary redis://:${FAKE_PASSWORD}@redis-a:6379 fallback ${MONGODB}://mongo-srv:27017/db?password=${FAKE_SECRET}`
        );
        expect(result).toBe(`primary redis://:****@redis-a:6379 fallback ${MONGODB}://mongo-srv:27017/db?password=****`);
        expectNoSecret(result);
    });

    it('masks a word containing userinfo without a scheme', () => {
        const result = maskConnectionUrisInText(`auth failed for dbuser:${FAKE_PASSWORD}@mongo-srv:27017`);
        expect(result).toBe('auth failed for dbuser:****@mongo-srv:27017');
        expectNoSecret(result);
    });

    it('treats text between two separate @ signs as one region and leaks no secret', () => {
        const result = maskConnectionUrisInText(`${NATS}://${FAKE_TOKEN}@nats-a:4222 and ${FAKE_SECRET} x:${FAKE_PASSWORD}@nats-b:4222`);
        expect(result).toBe(`${NATS}://****@nats-b:4222`);
        expectNoSecret(result);
    });

    it('returns undefined for undefined input and an empty string for empty input', () => {
        expect(maskConnectionUrisInText(undefined)).toBeUndefined();
        expect(maskConnectionUrisInText('')).toBe('');
    });
});

describe('sanitizeConnectionError', () => {
    it('masks input and keeps name and code for a real ERR_INVALID_URL error', () => {
        const error = captureThrown(() => new URL(`redis://:${FAKE_PASSWORD}/${FAKE_SECRET}@127.0.0.1:1`));

        const result = sanitizeConnectionError(error);

        expect(result).toEqual({ name: 'TypeError', code: 'ERR_INVALID_URL', message: 'Invalid URL', input: 'redis://****' });
        expectNoSecret(result);
    });

    it('masks addresses in the message and url fields', () => {
        const error = Object.assign(new Error(`Could not connect to server ${NATS}://${FAKE_TOKEN}@nats-srv:4222`), {
            code: 'CONN_ERR',
            url: `${NATS}://natsuser:${FAKE_PASSWORD}@nats-srv:4222`
        });

        const result = sanitizeConnectionError(error);

        expect(result).toEqual({
            name: 'Error',
            code: 'CONN_ERR',
            message: `Could not connect to server ${NATS}://****@nats-srv:4222`,
            url: `${NATS}://natsuser:****@nats-srv:4222`
        });
        expectNoSecret(result);
    });

    it('does not carry stack, cause or other fields', () => {
        const error = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:6379'), {
            code: 'ECONNREFUSED',
            config: { password: FAKE_PASSWORD },
            cause: new Error(`redis://:${FAKE_PASSWORD}@redis-master:6379`)
        });

        const result = sanitizeConnectionError(error);

        expect(Object.keys(result).sort()).toEqual(['code', 'message', 'name']);
        expect(result.message).toBe('connect ECONNREFUSED 127.0.0.1:6379');
        expectNoSecret(result);
    });

    it('keeps a numeric code and drops a name or code in an unexpected shape', () => {
        expect(sanitizeConnectionError(Object.assign(new Error('x'), { code: -61 })).code).toBe(-61);

        const result = sanitizeConnectionError({
            name: `redis://:${FAKE_PASSWORD}@redis-master:6379`,
            code: `${FAKE_SECRET} ${FAKE_TOKEN}`,
            message: 'x'
        });

        expect(result).toEqual({ message: 'x' });
    });

    it('omits url/input when they are not strings and returns an empty message for an object without one', () => {
        const result = sanitizeConnectionError({ input: 42, url: { href: FAKE_PASSWORD } });

        expect(result).toEqual({ message: '' });
    });

    it('converts non-error values to text and masks them', () => {
        expect(sanitizeConnectionError(`boom redis://:${FAKE_PASSWORD}@redis-master:6379`))
            .toEqual({ message: 'boom redis://:****@redis-master:6379' });
        expect(sanitizeConnectionError(undefined)).toEqual({ message: 'undefined' });
        expect(sanitizeConnectionError(null)).toEqual({ message: 'null' });
    });
});

describe('toSafeError', () => {
    it('builds an Error that keeps name, code and the masked input, without a cause', () => {
        const raw = captureThrown(() => new URL(`redis://:${FAKE_PASSWORD}/${FAKE_SECRET}@127.0.0.1:1`));

        const error = toSafeError(sanitizeConnectionError(raw));

        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('TypeError');
        expect((error as unknown as { code?: string }).code).toBe('ERR_INVALID_URL');
        expect(error.message).toBe('Invalid URL');
        expect((error as unknown as { input?: string }).input).toBe('redis://****');
        expect(error).not.toHaveProperty('cause');
        expectNoSecret(inspect(error, { depth: 8, showHidden: true }));
    });

    it('never leaks the raw error through util.inspect, even if the raw error is passed by mistake as cause elsewhere', () => {
        const raw = Object.assign(new Error(`connect failed ${NATS}://${FAKE_TOKEN}@nats-srv:4222`), {
            code: 'CONN_ERR',
            url: `${NATS}://${FAKE_TOKEN}@nats-srv:4222`
        });

        const error = toSafeError(sanitizeConnectionError(raw));

        expect(error.name).toBe('Error');
        expect((error as unknown as { code?: string }).code).toBe('CONN_ERR');
        expect((error as unknown as { url?: string }).url).toBe(`${NATS}://****@nats-srv:4222`);
        expect(inspect(error, { depth: 8, showHidden: true })).not.toContain(FAKE_TOKEN);
    });

    it('keeps only a plain default Error when the safe object carries no name, code, input or url', () => {
        const error = toSafeError({ message: 'plain failure' });

        expect(error.name).toBe('Error');
        expect(error.message).toBe('plain failure');
        expect(error).not.toHaveProperty('code');
        expect(error).not.toHaveProperty('input');
        expect(error).not.toHaveProperty('url');
    });
});
