import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';
import { Writable } from 'stream';
import winston from 'winston';
import { logger } from '../../../services/logger.service';
import { hashTenantId } from '../../../utils/logSafety.util';
import { BadRequestError } from '../../errors/bad-request-error';
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
