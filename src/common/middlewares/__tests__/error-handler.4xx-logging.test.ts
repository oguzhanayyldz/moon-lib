import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';
import { Writable } from 'stream';
import winston from 'winston';
import { logger } from '../../../services/logger.service';
import { hashTenantId } from '../../../utils/logSafety.util';
import { BadRequestError } from '../../errors/bad-request-error';
import { DatabaseConnectionError } from '../../errors/database-connection-error';
import { ServiceUnavailableError } from '../../errors/service-unavailable-error';
import { NotAuthorizedError } from '../../errors/not-authorized-error';
import { NotFoundError } from '../../errors/not-found-error';
import { RequestValidationError } from '../../errors/request-validation-error';
import { errorHandler } from '../error-handler';

// UC-2365: bir 4xx (CustomError) yanıtı tek bir yapılandırılmış warn satırı bırakır; satırda istek
// gövdesi, başlıklar, query değerleri, kişisel veri ve sır OLMAZ. Yanıt gövdesi değişmez.
const FAKE_BEARER = 'FAKE_4XX_BEARER_VALUE';
const FAKE_BODY_PASSWORD = 'FAKE_4XX_BODY_PASSWORD';
const FAKE_FIELD_VALUE = 'FAKE_4XX_FIELD_VALUE';
const FAKE_QUERY_TOKEN = 'FAKE_4XX_QUERY_TOKEN';
const FAKE_EMAIL = 'ali.veli@example.com';
const FAKE_PHONE = '0532 123 45 67';
const OBJECT_ID = '64b7f0c2a1b2c3d4e5f60718';
const TENANT_ID = '64b7f0c2a1b2c3d4e5ae6646';

const lines: string[] = [];
const capture = new winston.transports.Stream({
    stream: new Writable({
        write(chunk, _encoding, callback) {
            lines.push(chunk.toString());
            callback();
        }
    })
});

interface Call {
    method?: string;
    path: string;
    body?: string;
    headers?: Record<string, string>;
}

const send = (app: express.Express, call: Call) =>
    new Promise<{ status: number; body: any }>((resolve, reject) => {
        const server = app.listen(0, () => {
            const { port } = server.address() as AddressInfo;
            const req = http.request(
                { port, path: call.path, method: call.method || 'GET', headers: call.headers },
                (res) => {
                    let data = '';
                    res.on('data', (c) => (data += c));
                    res.on('end', () => {
                        server.close();
                        resolve({ status: res.statusCode || 0, body: data ? JSON.parse(data) : null });
                    });
                }
            );
            req.on('error', (e) => {
                server.close();
                reject(e);
            });
            if (call.body) {
                req.write(call.body);
            }
            req.end();
        });
    });

const appThrowing = (makeError: () => unknown, withUser = false) => {
    const app = express();
    app.use(express.json({ limit: '1kb' }));
    if (withUser) {
        app.use((req, _res, next) => {
            (req as any).currentUser = { id: TENANT_ID, email: FAKE_EMAIL };
            next();
        });
    }
    app.all('*', () => {
        throw makeError();
    });
    app.use(errorHandler);
    return app;
};

const warnLines = () => lines.filter((l) => l.includes('HTTP 4xx'));

describe('errorHandler 4xx logging (UC-2365)', () => {
    const previous = process.env.LOG_4XX;

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

    beforeEach(() => {
        lines.length = 0;
        delete process.env.LOG_4XX;
    });

    afterEach(() => {
        if (previous === undefined) {
            delete process.env.LOG_4XX;
        } else {
            process.env.LOG_4XX = previous;
        }
    });

    it('logs a 400 once at warn with status, method, class and a query-free path with ids collapsed', async () => {
        const res = await send(appThrowing(() => new BadRequestError('Stok yetersiz')), {
            path: `/api/orders/${OBJECT_ID}/items?token=${FAKE_QUERY_TOKEN}&page=2`
        });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ errors: [{ message: 'Stok yetersiz' }] });
        const found = warnLines();
        expect(found).toHaveLength(1);
        const line = found[0];
        expect(line).toContain('warn');
        expect(line).toContain('"status":400');
        expect(line).toContain('"method":"GET"');
        expect(line).toContain('"path":"/api/orders/:id/items"');
        expect(line).toContain('"error":"BadRequestError"');
        expect(line).toContain('Stok yetersiz');
        expect(line).not.toContain(OBJECT_ID);
        expect(line).not.toContain(FAKE_QUERY_TOKEN);
        expect(line).not.toContain('page=2');
    });

    it('masks personal data and bearer tokens inside the error message', async () => {
        await send(
            appThrowing(() => new BadRequestError(`Kullanıcı ${FAKE_EMAIL} / ${FAKE_PHONE} için Bearer ${FAKE_BEARER} geçersiz`)),
            { path: '/api/auth/x' }
        );

        const line = warnLines()[0];
        expect(line).toBeDefined();
        expect(line).not.toContain(FAKE_EMAIL);
        expect(line).not.toContain('example.com');
        expect(line).toContain('***PII***');
        expect(line).not.toContain('0532');
        expect(line).not.toContain(FAKE_BEARER);
        expect(line).toContain('geçersiz');
    });

    it('logs validation field NAMES only, never the submitted values', async () => {
        const errors = [
            { type: 'field', location: 'body', path: 'email', value: FAKE_FIELD_VALUE, msg: 'Email must be valid' },
            { type: 'field', location: 'body', path: 'password', value: FAKE_BODY_PASSWORD, msg: 'Password required' }
        ] as any;
        await send(appThrowing(() => new RequestValidationError(errors)), {
            method: 'POST',
            path: '/api/users/signup',
            body: JSON.stringify({ email: FAKE_EMAIL, password: FAKE_BODY_PASSWORD }),
            headers: { 'content-type': 'application/json', authorization: `Bearer ${FAKE_BEARER}`, cookie: `session=${FAKE_BEARER}` }
        });

        const line = warnLines()[0];
        expect(line).toBeDefined();
        expect(line).toContain('"error":"RequestValidationError"');
        expect(line).toContain('"fields":["email","password"]');
        expect(line).toContain('Email must be valid');
        expect(line).not.toContain(FAKE_FIELD_VALUE);
        expect(line).not.toContain(FAKE_BODY_PASSWORD);
        expect(line).not.toContain(FAKE_EMAIL);
        expect(line).not.toContain(FAKE_BEARER);
    });

    it('writes the tenant as a one-way hash, never the raw id', async () => {
        await send(appThrowing(() => new NotAuthorizedError(), true), { path: '/api/stock/count/active' });

        const line = warnLines()[0];
        expect(line).toBeDefined();
        expect(line).toContain('"status":401');
        expect(line).toContain(`"tenant":"${hashTenantId(TENANT_ID)}"`);
        expect(line).not.toContain(TENANT_ID);
        expect(line).not.toContain(FAKE_EMAIL);
    });

    it('logs 404 and the body-limit 413 too', async () => {
        await send(appThrowing(() => new NotFoundError()), { path: '/api/nope' });
        await send(appThrowing(() => new BadRequestError('unused')), {
            method: 'POST',
            path: '/api/big',
            body: JSON.stringify({ blob: 'x'.repeat(4096) }),
            headers: { 'content-type': 'application/json' }
        });

        const found = warnLines();
        expect(found).toHaveLength(2);
        expect(found[0]).toContain('"status":404');
        expect(found[1]).toContain('"status":413');
        expect(found[1]).not.toContain('xxxx');
    });

    it('caps the message count and length', async () => {
        const errors = Array.from({ length: 6 }, (_, i) => ({
            type: 'field', location: 'body', path: `f${i}`, value: 1, msg: `${i}-${'m'.repeat(400)}`
        })) as any;
        await send(appThrowing(() => new RequestValidationError(errors)), { method: 'POST', path: '/api/x' });

        const line = warnLines()[0];
        expect(line).toBeDefined();
        expect(line).toContain('"0-');
        expect(line).not.toContain('"3-');
        expect(line).not.toContain('m'.repeat(201));
    });

    it('stays silent when LOG_4XX=false and keeps the response', async () => {
        process.env.LOG_4XX = 'false';
        const res = await send(appThrowing(() => new BadRequestError('Stok yetersiz')), { path: '/api/x' });

        expect(res.status).toBe(400);
        expect(warnLines()).toHaveLength(0);
    });
});

// UC-2412 (UC-2365 tur 2, inceleme UC-2401): Peri'nin 17 kaçak örneği. Hepsi SAHTE değer; TC ve IBAN
// sentetik ve sağlama toplamı geçerli değerlerdir (gerçek kişiye ait değildir).
describe('errorHandler 4xx logging — UC-2412 leak samples', () => {
    const FAKE_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJGQUtFX1VDMjQxMiJ9.FAKE_UC2412_SIGNATURE';
    const FAKE_URI_PASS = 'FAKE_UC2412_URI_PASS';
    const FAKE_PASSWORD = 'FAKE_UC2412_PASSWORD';
    const FAKE_JSON_PASSWORD = 'FAKE_UC2412_JSON_PASSWORD';
    const FAKE_API_KEY = 'FAKE_UC2412_API_KEY';
    const FAKE_TC = '12345678950';
    const FAKE_IBAN = 'TR330006100519786457841326';
    const FAKE_IBAN_SPACED = 'TR33 0006 1005 1978 6457 8413 26';
    const ENCODED_EMAIL = 'ali.veli%40example.com';

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

    beforeEach(() => {
        lines.length = 0;
        delete process.env.LOG_4XX;
    });

    const lineFor = async (message: string, path = '/api/x', withUser = false) => {
        lines.length = 0;
        await send(appThrowing(() => new BadRequestError(message), withUser), { method: 'POST', path });
        const found = warnLines();
        expect(found).toHaveLength(1);
        return found[0];
    };

    it.each([
        ['1 JWT', `oturum ${FAKE_JWT} geçersiz`, ['FAKE_UC2412_SIGNATURE', 'eyJzdWIi']],
        ['2 Bearer', `Authorization: Bearer ${FAKE_BEARER}`, [FAKE_BEARER]],
        ['3 URI parolası', `mongodb://usr:${FAKE_URI_PASS}@db:27017/x bağlanamadı`, [FAKE_URI_PASS]],
        ['4 e-posta', `${FAKE_EMAIL} zaten kayıtlı`, [FAKE_EMAIL, 'example.com']],
        ['5 telefon', `+90 532 123 45 67 geçersiz`, ['532 123']],
        ['9 password=', `giriş başarısız password=${FAKE_PASSWORD} kullanıcı=x`, [FAKE_PASSWORD]],
        ['10 JSON parola', `{"user":"x","password":"${FAKE_JSON_PASSWORD}"}`, [FAKE_JSON_PASSWORD]],
        ['11 apiKey=', `entegrasyon apiKey=${FAKE_API_KEY} reddedildi`, [FAKE_API_KEY]],
        ['12 TC kimlik', `TC ${FAKE_TC} doğrulanamadı`, [FAKE_TC]],
        ['13a IBAN bitişik', `IBAN ${FAKE_IBAN} geçersiz`, [FAKE_IBAN, '0006100519786457841326']],
        ['13b IBAN boşluklu', `IBAN ${FAKE_IBAN_SPACED} geçersiz`, [FAKE_IBAN_SPACED, '1978 6457']],
        ['14 URL kodlu e-posta', `alıcı ${ENCODED_EMAIL} bulunamadı`, [ENCODED_EMAIL, 'ali.veli']]
    ])('masks %s inside the message', async (_name, message, leaks) => {
        const line = await lineFor(message as string);
        for (const leak of leaks as string[]) {
            expect(line).not.toContain(leak);
        }
    });

    it('6 query values, 15 an e-mail and 16 a JWT inside the path never reach the line', async () => {
        const line = await lineFor('x', `/api/users/veli@example.com/reset/${FAKE_JWT}?token=${FAKE_QUERY_TOKEN}&email=${ENCODED_EMAIL}`);

        expect(line).toContain('"path":"/api/users/');
        expect(line).not.toContain('veli@example.com');
        expect(line).not.toContain('example.com');
        expect(line).not.toContain('FAKE_UC2412_SIGNATURE');
        expect(line).not.toContain(FAKE_QUERY_TOKEN);
        expect(line).not.toContain('ali.veli');
    });

    it('7 field values / details and 17 an e-mail inside a field NAME never reach the line', async () => {
        const errors = [
            { type: 'field', location: 'body', path: 'items[ali@x.com]', value: FAKE_FIELD_VALUE, msg: 'Geçersiz' },
            { type: 'field', location: 'body', path: 'iban', value: FAKE_IBAN, msg: 'Geçersiz IBAN' }
        ] as any;
        await send(appThrowing(() => new RequestValidationError(errors)), { method: 'POST', path: '/api/x' });
        await send(appThrowing(() => new BadRequestError('detaylı', { email: FAKE_EMAIL, password: FAKE_PASSWORD })), { path: '/api/y' });

        const found = warnLines();
        expect(found).toHaveLength(2);
        const all = found.join('\n');
        expect(all).toContain('"fields":["items[***PII***]","iban"]');
        expect(all).not.toContain('ali@x.com');
        expect(all).not.toContain(FAKE_FIELD_VALUE);
        expect(all).not.toContain(FAKE_IBAN);
        expect(all).not.toContain(FAKE_EMAIL);
        expect(all).not.toContain(FAKE_PASSWORD);
    });

    it('8 the raw tenant id never reaches the line', async () => {
        const line = await lineFor('x', '/api/x', true);
        expect(line).not.toContain(TENANT_ID);
        expect(line).toContain(`"tenant":"${hashTenantId(TENANT_ID)}"`);
    });

    it('keeps an 11-digit number that is not a valid TC (order number) readable', async () => {
        const line = await lineFor('Sipariş 12345678901 bulunamadı');
        expect(line).toContain('12345678901');
    });

    it('does not label a 5xx CustomError as HTTP 4xx; it is logged as HTTP 5xx at error', async () => {
        await send(appThrowing(() => new DatabaseConnectionError()), { path: '/api/x' });
        await send(appThrowing(() => new ServiceUnavailableError()), { path: '/api/y' });

        expect(warnLines()).toHaveLength(0);
        const fiveXx = lines.filter((l) => l.includes('HTTP 5xx'));
        expect(fiveXx).toHaveLength(2);
        expect(fiveXx[0]).toContain('error');
        expect(fiveXx[0]).toContain('"status":500');
        expect(fiveXx[1]).toContain('"status":503');
    });
});
