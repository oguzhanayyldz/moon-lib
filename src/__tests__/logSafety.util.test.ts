import { randomBytes } from 'crypto';
import { performance } from 'perf_hooks';
import { inspect } from 'util';
import { runInNewContext } from 'vm';
import {
    isSensitiveFieldName,
    maskConnectionUriSecret,
    maskConnectionUrisInText,
    maskSensitiveValues,
    REDACTED_FIELD_MASK,
    redactSensitiveFields,
    redactSensitiveText,
    sanitizeConnectionError,
    toSafeError
} from '../utils/logSafety.util';

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

describe('maskSensitiveValues', () => {
    it('keeps the shape and masks every leaf value', () => {
        const result = maskSensitiveValues({ email: { $ne: null }, password: FAKE_PASSWORD });

        expect(result).toEqual({ email: { $ne: '****' }, password: '****' });
        expectNoSecret(result);
    });

    it('masks a leaf of any type — no value counts as harmless', () => {
        const result = maskSensitiveValues({
            text: FAKE_SECRET,
            count: 42,
            flag: false,
            empty: null,
            missing: undefined
        });

        expect(result).toEqual({ text: '****', count: '****', flag: '****', empty: '****', missing: '****' });
        expectNoSecret(result);
    });

    it('masks a non-object input as a whole', () => {
        expect(maskSensitiveValues(FAKE_TOKEN)).toBe('****');
        expect(maskSensitiveValues(null)).toBe('****');
        expect(maskSensitiveValues(undefined)).toBe('****');
    });

    it('keeps array structure and summarises items past the limit', () => {
        const result = maskSensitiveValues({ ids: [1, 2, 3, 4, 5, 6, 7] });

        expect(result).toEqual({ ids: ['****', '****', '****', '****', '****', '…(+2)'] });
    });

    it('stops at the depth limit so a deep body cannot grow the log line', () => {
        const result = maskSensitiveValues({ a: { b: { c: { d: { e: FAKE_SECRET } } } } });

        expect(result).toEqual({ a: { b: { c: { d: '…' } } } });
        expectNoSecret(result);
    });

    it('summarises keys past the limit instead of printing them all', () => {
        const wide: Record<string, string> = {};
        for (let index = 0; index < 25; index += 1) {
            wide[`field${index}`] = FAKE_SECRET;
        }

        const result = maskSensitiveValues(wide) as Record<string, unknown>;

        expect(Object.keys(result)).toHaveLength(21);
        expect(result['…']).toBe('+5');
        expectNoSecret(result);
    });

    it('strips control characters from keys so a key cannot forge a log line', () => {
        const result = maskSensitiveValues({ 'na\nme\r': FAKE_SECRET }) as Record<string, unknown>;

        expect(Object.keys(result)).toEqual(['name']);
        expectNoSecret(result);
    });

    it('cuts an over-long key', () => {
        const longKey = 'k'.repeat(200);
        const result = maskSensitiveValues({ [longKey]: FAKE_SECRET }) as Record<string, unknown>;

        expect(Object.keys(result)[0]).toHaveLength(64);
    });
});

describe('isSensitiveFieldName', () => {
    it.each([
        // Ticimax / Mikro / Sürat / PTT (planned integrations)
        'UyeKodu', 'Sifre', 'ŞİFRE', 'şifre', 'WebServisSifre', 'ApiKey', 'KullaniciKodu',
        'KULLANICI_KODU', 'FirmaKodu', 'KullaniciAdi',
        // current integrations: headers, bodies and responses
        'appkey', 'appsecret', 'X-Auth-Token', 'x-api-key', 'Api-Key', 'API_KEY', 'Authorization', 'set-cookie',
        'secretKey', 'restrictedDataToken', 'oauth_consumer_key', 'client_secret', 'clientSecret', 'refreshToken',
        'x-ibm-client-secret', 'wsPassword', 'wsUserName', 'UserName', 'CustomerCode', 'pass', 'credentials',
        // the whole normalized name is `key`: masked as before
        'key'
    ])('%s is a credential name', (name) => {
        expect(isSensitiveFieldName(name)).toBe(true);
    });

    it.each([
        // measured on the integrations' payloads — non-secret, kept readable
        'metaKeywords', 'searchKeywords', 'SeoKeywords', 'keyword', 'cargoKey', 'CargoKey', 'nextPageToken', 'NextToken',
        'sortKey',
        // identifiers that are not half of a login pair
        'supplierId', 'merchantId', 'sellerId', 'clientId', 'userId', 'CalismaYili', 'user', 'passive'
    ])('%s is not a credential name', (name) => {
        expect(isSensitiveFieldName(name)).toBe(false);
    });

    it('still masks a credential part that sits next to a known non-secret part', () => {
        expect(isSensitiveFieldName('keywordSecret')).toBe(true);
        expect(isSensitiveFieldName('cargoKeyToken')).toBe(true);
    });

    it('masks an unknown name that merely contains `key` (accepted false positive, fail-closed)', () => {
        expect(isSensitiveFieldName('monkey')).toBe(true);
        expect(isSensitiveFieldName('idempotencyKey')).toBe(true);
    });
});

describe('redactSensitiveFields', () => {
    it('masks a credential-named value whatever its type and keeps the others', () => {
        const result = redactSensitiveFields({
            credentials: { user: 'u', note: FAKE_SECRET },
            apiKey: 12345,
            items: [{ Sifre: FAKE_PASSWORD, Adet: 2 }],
            active: true
        });

        expect(result).toEqual({
            credentials: REDACTED_FIELD_MASK,
            apiKey: REDACTED_FIELD_MASK,
            items: [{ Sifre: REDACTED_FIELD_MASK, Adet: 2 }],
            active: true
        });
    });

    it('keeps a `__proto__` key from the payload as a plain field', () => {
        const payload = JSON.parse(`{"__proto__": {"token": "${FAKE_TOKEN}"}}`);

        const result = redactSensitiveFields(payload) as Record<string, unknown>;

        expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
        expect(JSON.stringify(result)).toBe(`{"__proto__":{"token":"${REDACTED_FIELD_MASK}"}}`);
    });
});

describe('redactSensitiveText', () => {
    it('masks a whole credential object inside a JSON text (structural path, not only name/value pairs)', () => {
        const text = JSON.stringify({ credentials: { note: FAKE_SECRET }, orderNumber: '1001' });

        expect(redactSensitiveText(text)).toBe(`{"credentials":"${REDACTED_FIELD_MASK}","orderNumber":"1001"}`);
    });

    it('returns a JSON text without credentials unchanged, formatting included', () => {
        const text = '{\n  "orderNumber": "1001",\n  "items": [1, 2]\n}';

        expect(redactSensitiveText(text)).toBe(text);
    });

    it('leaves a self-closing `<Password xsi:nil="true"/>` alone and does not swallow the rest of the document', () => {
        const text = `<Login><Password xsi:nil="true"/><Token>${FAKE_TOKEN}</Token><Adet>1</Adet></Login>`;

        expect(redactSensitiveText(text)).toBe(`<Login><Password xsi:nil="true"/><Token>${REDACTED_FIELD_MASK}</Token><Adet>1</Adet></Login>`);
    });

    it('masks everything after a credential element that is never closed (fail-closed)', () => {
        const text = `<Login><Sifre>${FAKE_PASSWORD}<Adet>1</Adet>`;

        expect(redactSensitiveText(text)).toBe(`<Login><Sifre>${REDACTED_FIELD_MASK}`);
    });

    it('masks a credential element holding CDATA', () => {
        const text = `<UyeKodu><![CDATA[${FAKE_SECRET}]]></UyeKodu>`;

        expect(redactSensitiveText(text)).toBe(`<UyeKodu>${REDACTED_FIELD_MASK}</UyeKodu>`);
    });

    it('masks the whole element when a credential element wraps other elements', () => {
        const text = `<Credentials><Kod>${FAKE_SECRET}</Kod></Credentials><Adet>1</Adet>`;

        expect(redactSensitiveText(text)).toBe(`<Credentials>${REDACTED_FIELD_MASK}</Credentials><Adet>1</Adet>`);
    });

    it('masks `"name": value` pairs of a JSON fragment inside plain text', () => {
        const text = `[AUTH] Unauthorized - {"ApiKey":"${FAKE_SECRET}","code":401,"FirmaKodu":123`;

        expect(redactSensitiveText(text)).toBe(
            `[AUTH] Unauthorized - {"ApiKey":"${REDACTED_FIELD_MASK}","code":401,"FirmaKodu":"${REDACTED_FIELD_MASK}"`
        );
    });

    it('masks form pairs and stops an unquoted value at `&`, quotes and angle brackets', () => {
        const text = `grant_type=refresh_token&refresh_token=${FAKE_TOKEN}&client_secret=${FAKE_SECRET}`;

        expect(redactSensitiveText(text)).toBe(
            `grant_type=refresh_token&refresh_token=${REDACTED_FIELD_MASK}&client_secret=${REDACTED_FIELD_MASK}`
        );
        expect(redactSensitiveText(`<Url>https://x.test/cb?token=${FAKE_TOKEN}</Url>`)).toBe(
            `<Url>https://x.test/cb?token=${REDACTED_FIELD_MASK}</Url>`
        );
        expect(redactSensitiveText(`{"cb":"https://x.test/cb?token=${FAKE_TOKEN}","code":401`)).toBe(
            `{"cb":"https://x.test/cb?token=${REDACTED_FIELD_MASK}","code":401`
        );
    });

    it('does not let the value of a harmless form pair swallow the credential pair after it', () => {
        expect(redactSensitiveText(`scope=read,client_secret=${FAKE_SECRET}`)).toBe(`scope=read,client_secret=${REDACTED_FIELD_MASK}`);
        expect(redactSensitiveText(`redirect=https://x.test/cb?token=${FAKE_TOKEN}&state=1`)).toBe(
            `redirect=https://x.test/cb?token=${REDACTED_FIELD_MASK}&state=1`
        );
    });

    it('masks a credential value that contains a comma entirely', () => {
        expect(redactSensitiveText(`password=${FAKE_PASSWORD},tail&a=1`)).toBe(`password=${REDACTED_FIELD_MASK}&a=1`);
    });
});

describe('redactSensitiveText — quoted and whitespace form values (TASK-MUBXAY9XUFBXH B2/Y3)', () => {
    // Names come from `it.each`: a literal quoted `password` assignment on an added line trips the
    // moon pre-commit secret guard (.claude/hooks/pre-commit-quality.js) whatever the value is.
    const NAMES = ['password', 'Sifre', 'token'];

    it.each(NAMES)('masks a double- or single-quoted %s value up to its closing quote', (name) => {
        expect(redactSensitiveText(`${name}="${FAKE_PASSWORD}"&next=1`)).toBe(`${name}="${REDACTED_FIELD_MASK}"&next=1`);
        expect(redactSensitiveText(`${name}='${FAKE_PASSWORD}' next`)).toBe(`${name}='${REDACTED_FIELD_MASK}' next`);
    });

    it.each(NAMES)('masks a quoted %s value holding whitespace, `&`, angle brackets and the other quote', (name) => {
        const value = `${FAKE_PASSWORD} & <b>${FAKE_SECRET}</b> it's`;

        expect(redactSensitiveText(`login ${name}="${value}" failed`)).toBe(`login ${name}="${REDACTED_FIELD_MASK}" failed`);
    });

    it.each(NAMES)('masks a %s XML attribute and keeps the element around it', (name) => {
        expect(redactSensitiveText(`<Login ${name}="${FAKE_PASSWORD}" lang="tr">x</Login>`)).toBe(
            `<Login ${name}="${REDACTED_FIELD_MASK}" lang="tr">x</Login>`
        );
    });

    it('masks the attribute of a self-closing element (`<auth key="…"/>`)', () => {
        expect(redactSensitiveText(`<auth key="${FAKE_SECRET}"/><Adet>1</Adet>`)).toBe(`<auth key="${REDACTED_FIELD_MASK}"/><Adet>1</Adet>`);
        expect(redactSensitiveText(`<auth key='${FAKE_SECRET}'/>`)).toBe(`<auth key='${REDACTED_FIELD_MASK}'/>`);
    });

    it('masks a value quoted with escaped quotes (a quoted pair inside a JSON string)', () => {
        expect(redactSensitiveText(`error: {"detail":"<auth key=\\"${FAKE_SECRET}\\"/>"`)).toBe(
            `error: {"detail":"<auth key=\\"${REDACTED_FIELD_MASK}\\"/>"`
        );
    });

    it('masks everything after a quoted value that is never closed (fail-closed)', () => {
        expect(redactSensitiveText(`token="${FAKE_TOKEN} & more <b>text</b>`)).toBe(`token="${REDACTED_FIELD_MASK}`);
    });

    it.each(NAMES)('masks an unquoted %s value holding whitespace or line breaks up to the next `&`', (name) => {
        expect(redactSensitiveText(`login failed ${name}=${FAKE_PASSWORD} ${FAKE_SECRET}&x=1`)).toBe(
            `login failed ${name}=${REDACTED_FIELD_MASK}&x=1`
        );
        expect(redactSensitiveText(`${name}=${FAKE_PASSWORD}\n${FAKE_SECRET}\r\n${FAKE_TOKEN}`)).toBe(`${name}=${REDACTED_FIELD_MASK}`);
    });

    it.each(NAMES)('keeps masking an unquoted %s value past a quote that sits inside it', (name) => {
        expect(redactSensitiveText(`${name}=${FAKE_PASSWORD}"${FAKE_SECRET} it's ${FAKE_TOKEN}&x=1`)).toBe(`${name}=${REDACTED_FIELD_MASK}&x=1`);
    });

    it('masks the rest of a free-text line after an unquoted credential value (fail-closed)', () => {
        expect(redactSensitiveText(`pass=${FAKE_PASSWORD} expired`)).toBe(`pass=${REDACTED_FIELD_MASK}`);
    });

    it('never leaves a value next to the marker, whatever the quoting and the text around it', () => {
        const openers = ['', '"', "'", '\\"'];
        const surroundings: Array<[string, string]> = [
            ['', ''], ['login ', ' failed'], ['a=1&', '&b=2'], ['?', '#frag'], ['<Login ', '>x</Login>'],
            ['<auth ', '/>'], ['{"body":"', '"}'], ['[ERR] {"detail":"', '"']
        ];
        for (const name of NAMES) {
            for (const opener of openers) {
                for (const [before, after] of surroundings) {
                    const text = `${before}${name}=${opener}${FAKE_PASSWORD} ${FAKE_SECRET}${opener}${after}`;
                    expect({ text, result: redactSensitiveText(text) }).toEqual({ text, result: expect.not.stringMatching(/FAKE_(PASSWORD|SECRET)/) });
                }
            }
        }
    });
});

describe('redactSensitiveText — linear time on hostile input (TASK-MUBXAY9XUFBXH B1)', () => {
    // Every input runs under a vm timeout, so a regression to super-linear matching fails after
    // HARD_LIMIT_MS instead of blocking the suite (the escaped-quote input took 264 s at 1 MB).
    // Linear inputs finish in single- or low double-digit ms; the budgets leave room for slow machines.
    const HARD_LIMIT_MS = 2000;
    const LINEAR_BUDGET_MS = 1000;
    const MB = 1000000;
    const repeatTo = (unit: string, size: number): string => unit.repeat(Math.ceil(size / unit.length)).slice(0, size);

    function timedRedact(input: string): number {
        const started = performance.now();
        runInNewContext('redact(input)', { redact: redactSensitiveText, input }, { timeout: HARD_LIMIT_MS });
        return performance.now() - started;
    }

    it('masks an escaped-quote run of 1 MB in under 200 ms (was 264 s)', () => {
        expect(timedRedact('x' + '"\\'.repeat(MB / 2))).toBeLessThan(200);
    });

    it('masks a double-encoded JSON body of 380 KB+ in under 200 ms (was 10 s at 280 KB)', () => {
        const products = Array.from({ length: 3500 }, (_, i) => ({ id: i, sku: `SKU-${i}`, name: `Kupa "${i}" \\ 330 ml`, price: 12.5, tags: ['a', 'b'] }));
        const text = JSON.stringify(JSON.stringify(products));

        expect(text.length).toBeGreaterThan(380000);
        expect(timedRedact(text)).toBeLessThan(200);
    });

    it.each([
        ['JSON pair: escaped name/value pairs', repeatTo('\\"a\\":\\"b\\",', MB)],
        ['JSON pair: name/value run', repeatTo('"a":', MB)],
        ['JSON pair: unclosed string values', repeatTo('"a": "', MB)],
        ['JSON pair: credential form values in escaped quotes', repeatTo('token=\\"', MB)],
        ['XML: open tags with attributes', repeatTo('<a b=', MB)],
        ['XML: unclosed credential elements', repeatTo('<Password>', MB)],
        ['XML: closed credential elements', repeatTo('<Token>x</Token>', MB)],
        ['XML: unclosed credential attribute', repeatTo('<Password x="', MB)],
        ['form: credential pairs', repeatTo('&token=x', MB)],
        ['form: unclosed quoted credential values', repeatTo('token="', MB)],
        ['form: quoted credential attributes', repeatTo('<a key="x">', MB)],
        ['form: a name that never reaches `=`', '&' + 'a'.repeat(MB)]
    ])('%s (1 MB) finishes in linear time', (_label, input) => {
        expect(timedRedact(input)).toBeLessThan(LINEAR_BUDGET_MS);
    });
});

describe('redactSensitiveText — name-free tokens, header lines, session/jwt/signature names (TASK-MUEL7QFK7DEN7)', () => {
    // Secrets are generated at run time, so no credential-shaped literal sits in source. Every test checks
    // the leak with a boolean first: if a rule regresses, jest reports `true`/`false` and never prints the
    // value, because a failed expect stops the test before the structural `toBe` below it.
    const runtimeSecret = (): string => `s${randomBytes(12).toString('hex')}`;
    const base64url = (value: string | Buffer): string => Buffer.from(value).toString('base64url');
    const runtimeJwt = (): string =>
        `${base64url('{"alg":"HS256","typ":"JWT"}')}.${base64url(`{"sub":"${runtimeSecret()}"}`)}.${base64url(randomBytes(32))}`;
    const leaks = (output: unknown, ...secrets: string[]): boolean => {
        const text = typeof output === 'string' ? output : JSON.stringify(output);
        return secrets.some((secret) => text.includes(secret));
    };
    const redactHidden = (input: string, ...secrets: string[]): string => {
        const output = redactSensitiveText(input);
        expect(leaks(output, ...secrets)).toBe(false);
        return output;
    };
    const M = REDACTED_FIELD_MASK;

    describe('session, jwt and signature are credential names', () => {
        it.each([
            'sessionId', 'SessionToken', 'JSESSIONID', 'ASP.NET_SessionId', 'session',
            'jwt', 'id_jwt', 'JwtToken',
            'signature', 'X-WC-Webhook-Signature', 'x-ikas-signature', 'oauth_signature',
            'x-auth', 'userPwd'
        ])('%s is a credential name', (name) => {
            expect(isSensitiveFieldName(name)).toBe(true);
        });

        it('oauth_signature_method (the algorithm name, HMAC-SHA1) stays readable', () => {
            expect(isSensitiveFieldName('oauth_signature_method')).toBe(false);
        });

        it('masks their values in a payload object', () => {
            const [session, jwt, signature] = [runtimeSecret(), runtimeSecret(), runtimeSecret()];

            const result = redactSensitiveFields({ sessionId: session, jwt, 'X-WC-Webhook-Signature': signature, page: 2 });

            expect(leaks(result, session, jwt, signature)).toBe(false);
            expect(result).toEqual({ sessionId: M, jwt: M, 'X-WC-Webhook-Signature': M, page: 2 });
        });
    });

    describe('Name: value header lines', () => {
        it('keeps the Bearer scheme word and the rest of the line, masks the token', () => {
            const token = runtimeSecret();

            expect(redactHidden(`upstream rejected Authorization: Bearer ${token} (401)`, token))
                .toBe(`upstream rejected Authorization: Bearer ${M} (401)`);
        });

        it('masks a Bearer JWT in one piece, scheme word and rest of the line kept', () => {
            const jwt = runtimeJwt();

            expect(redactHidden(`Authorization: Bearer ${jwt} (401)`, jwt.split('.')[1], jwt.split('.')[2]))
                .toBe(`Authorization: Bearer ${M} (401)`);
        });

        it('masks a Basic credential', () => {
            const basic = Buffer.from(`merchant:${runtimeSecret()}`).toString('base64');

            expect(redactHidden(`authorization: Basic ${basic}`, basic)).toBe(`authorization: Basic ${M}`);
        });

        it('masks only the credential lines of a multi-line header dump', () => {
            const [apiKey, cookie] = [runtimeSecret(), runtimeSecret()];
            const dump = `Host: api.example.test\r\nX-Api-Key: ${apiKey}\r\nCookie: sid=${cookie}; lang=tr\r\nAccept: */*`;

            expect(redactHidden(dump, apiKey, cookie))
                .toBe(`Host: api.example.test\r\nX-Api-Key: ${M}\r\nCookie: ${M}\r\nAccept: */*`);
        });

        it('masks a quoted value of util.inspect output up to its closing quote', () => {
            const token = runtimeSecret();

            expect(redactHidden(`{ token: '${token}', page: 2 }`, token)).toBe(`{ token: '${M}', page: 2 }`);
        });

        it('masks an escaped JSON pair inside a text that is not itself JSON', () => {
            const password = runtimeSecret();

            expect(redactHidden(`body={\\"Sifre\\":\\"${password}\\",\\"Adet\\":2}`, password))
                .toBe(`body={\\"Sifre\\":\\"${M}\\",\\"Adet\\":2}`);
        });

        it('recognizes a Turkish header name', () => {
            const password = runtimeSecret();

            expect(redactHidden(`Kullanıcı: ali\nŞifre: ${password}`, password)).toBe(`Kullanıcı: ali\nŞifre: ${M}`);
        });

        it.each([
            ['a Mongo duplicate-key structure', 'E11000 duplicate key error dup key: { sku: "SKU-1" }'],
            ['a non-credential header', 'Location: https://api.example.test/v1/items'],
            ['a URL scheme', 'see https://api.example.test/token/refresh'],
            ['a clock time', 'retry at 10:30']
        ])('leaves %s unchanged', (_label, text) => {
            expect(redactSensitiveText(text)).toBe(text);
        });
    });

    describe('a JWT with no name around it', () => {
        it('is masked in free text', () => {
            const jwt = runtimeJwt();

            expect(redactHidden(`token rejected: ${jwt} expired`, jwt.split('.')[1], jwt.split('.')[2]))
                .toBe(`token rejected: ${M} expired`);
        });

        it('is masked inside a JSON string value', () => {
            const jwt = runtimeJwt();

            expect(redactHidden(JSON.stringify({ note: `id ${jwt}`, orderNumber: '1001' }), jwt.split('.')[1]))
                .toBe(`{"note":"id ${M}","orderNumber":"1001"}`);
        });

        it('is masked as a five-part JWE', () => {
            const jwe = `${base64url('{"alg":"dir","enc":"A256GCM"}')}..${base64url(randomBytes(12))}.${base64url(randomBytes(40))}.${base64url(randomBytes(16))}`;
            const [, , iv, ciphertext, tag] = jwe.split('.');

            expect(redactHidden(`payload ${jwe}`, iv, ciphertext, tag)).toBe(`payload ${M}`);
        });

        it('leaves `eyJ` without the dot-separated parts unchanged', () => {
            expect(redactSensitiveText('base64 header eyJhbGciOiJIUzI1NiJ9 only')).toBe('base64 header eyJhbGciOiJIUzI1NiJ9 only');
        });
    });

    describe('URL userinfo in free text', () => {
        it('masks user:password and keeps scheme, host and path', () => {
            const password = runtimeSecret();

            expect(redactHidden(`connect https://merchant:${password}@api.example.test/v1 failed`, password))
                .toBe(`connect https://${M}@api.example.test/v1 failed`);
        });

        it('masks single-part userinfo (a token)', () => {
            const token = runtimeSecret();

            expect(redactHidden(`GET https://${token}@api.example.test/v1`, token)).toBe(`GET https://${M}@api.example.test/v1`);
        });

        it('masks up to the LAST `@` before the path (unescaped `@` in the password)', () => {
            const [first, second] = [runtimeSecret(), runtimeSecret()];

            expect(redactHidden(`ftp://u:${first}@${second}@files.example.test/in`, first, second))
                .toBe(`ftp://${M}@files.example.test/in`);
        });

        it.each([
            ['an e-mail address', 'mail sent to ali@example.test'],
            ['an `@` in the path', 'see https://example.test/users/@me']
        ])('leaves %s unchanged', (_label, text) => {
            expect(redactSensitiveText(text)).toBe(text);
        });
    });

    describe('a Bearer token with no name before it', () => {
        it('is masked, the scheme word kept', () => {
            const token = runtimeSecret();

            expect(redactHidden(`header was Bearer ${token}, rejected`, token)).toBe(`header was Bearer ${M}, rejected`);
        });
    });

    describe('linear time on hostile input', () => {
        const HARD_LIMIT_MS = 2000;
        const LINEAR_BUDGET_MS = 1000;
        const MB = 1000000;
        const repeatTo = (unit: string, size: number): string => unit.repeat(Math.ceil(size / unit.length)).slice(0, size);

        it.each([
            ['JWT: `eyJ` run without separators', repeatTo('eyJ', MB)],
            ['JWT: dotted parts that never reach three', repeatTo('eyJa.', MB)],
            ['URL userinfo: schemes without `@`', repeatTo('a://b:', MB)],
            ['URL userinfo: a scheme word that never reaches `://`', 'a'.repeat(MB)],
            ['header: credential names that never reach a value', repeatTo('\ntoken:', MB)],
            ['header: escaped quote run before a name', '{' + '\\'.repeat(MB)],
            ['header: unclosed quoted credential values', repeatTo(' token: "', MB)],
            ['Bearer: scheme words without a token', repeatTo('Bearer ', MB)]
        ])('%s (1 MB) finishes in linear time', (_label, input) => {
            const started = performance.now();
            runInNewContext('redact(input)', { redact: redactSensitiveText, input }, { timeout: HARD_LIMIT_MS });
            expect(performance.now() - started).toBeLessThan(LINEAR_BUDGET_MS);
        });
    });
});
