import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';
import { Writable } from 'stream';
import winston from 'winston';
import { logger } from '../../../services/logger.service';
import { errorHandler } from '../error-handler';

// UC-832: an unexpected error is logged through the safe logger, not dumped raw with console.error
// (an AxiosError dump carries the request headers). The response stays 400 "Something went wrong".
const FAKE_BEARER = 'FAKE_HANDLER_BEARER';
const FAKE_HEADER_KEY = 'FAKE_HANDLER_HEADER_KEY';

const lines: string[] = [];
const capture = new winston.transports.Stream({
    stream: new Writable({
        write(chunk, _encoding, callback) {
            lines.push(chunk.toString());
            callback();
        }
    })
});

const get = (app: express.Express, path: string) =>
    new Promise<{ status: number; body: any }>((resolve, reject) => {
        const server = app.listen(0, () => {
            const { port } = server.address() as AddressInfo;
            http.get({ port, path }, (res) => {
                let data = '';
                res.on('data', (c) => (data += c));
                res.on('end', () => {
                    server.close();
                    resolve({ status: res.statusCode || 0, body: data ? JSON.parse(data) : null });
                });
            }).on('error', (e) => {
                server.close();
                reject(e);
            });
        });
    });

const axiosLikeError = () => {
    const error = new Error('Request failed with status code 401') as Error & Record<string, unknown>;
    error.isAxiosError = true;
    error.config = {
        method: 'get',
        url: 'https://api.example.com/v1/orders?page=1',
        headers: { Authorization: `Bearer ${FAKE_BEARER}`, 'X-Api-Key': `${FAKE_HEADER_KEY}` }
    };
    error.response = { status: 401, headers: {}, data: { detail: 'unauthorized' } };
    return error;
};

const buildApp = () => {
    const app = express();
    app.get('/orders', () => {
        throw axiosLikeError();
    });
    app.use(errorHandler);
    return app;
};

describe('errorHandler logging (UC-832)', () => {
    let consoleErrorSpy: jest.SpyInstance;

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
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => consoleErrorSpy.mockRestore());

    it('logs an unexpected error without its request headers and keeps the 400 response', async () => {
        const res = await get(buildApp(), '/orders?token=abc');

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ errors: [{ message: 'Something went wrong' }] });
        expect(consoleErrorSpy).not.toHaveBeenCalled();
        expect(lines).toHaveLength(1);
        const line = lines[0];
        expect(line).not.toContain(FAKE_BEARER);
        expect(line).not.toContain(FAKE_HEADER_KEY);
        expect(line).not.toContain('token=abc');
        expect(line).toContain('Request failed with status code 401');
        expect(line).toContain('GET /orders');
        expect(line).toContain('"status":401');
    });
});
