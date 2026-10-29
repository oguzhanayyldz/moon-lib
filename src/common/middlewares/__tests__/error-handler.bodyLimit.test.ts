import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';
import { errorHandler } from '../error-handler';

// UC-1175: body-parser'ın 413'ü errorHandler'da 400 "Something went wrong"'a dönüşmemeli
const post = (app: express.Express, body: string, contentType: string) =>
    new Promise<{ status: number; body: any }>((resolve, reject) => {
        const server = app.listen(0, () => {
            const { port } = server.address() as AddressInfo;
            const req = http.request(
                { port, method: 'POST', path: '/x', headers: { 'content-type': contentType } },
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
            req.end(body);
        });
    });

const buildApp = () => {
    const app = express();
    app.use(express.json({ limit: '1kb' }));
    app.use(express.urlencoded({ limit: '1kb', extended: true }));
    app.post('/x', (_req, res) => {
        res.status(200).send({ ok: true });
    });
    app.use(errorHandler);
    return app;
};

describe('errorHandler — gövde limiti (UC-1175)', () => {
    let errorSpy: jest.SpyInstance;
    beforeEach(() => {
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });
    afterEach(() => errorSpy.mockRestore());

    it('json limiti aşılınca 413 döner', async () => {
        const res = await post(buildApp(), JSON.stringify({ a: 'x'.repeat(2048) }), 'application/json');
        expect(res.status).toBe(413);
        expect(res.body).toEqual({ errors: [{ message: 'Request body too large' }] });
    });

    it('urlencoded limiti aşılınca 413 döner', async () => {
        const res = await post(buildApp(), `a=${'x'.repeat(2048)}`, 'application/x-www-form-urlencoded');
        expect(res.status).toBe(413);
    });

    it('limit içindeki gövde etkilenmez', async () => {
        const res = await post(buildApp(), JSON.stringify({ a: 'x' }), 'application/json');
        expect(res.status).toBe(200);
    });

    it('bozuk JSON eskisi gibi 400 kalır', async () => {
        const res = await post(buildApp(), '{bozuk', 'application/json');
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ errors: [{ message: 'Something went wrong' }] });
    });
});
