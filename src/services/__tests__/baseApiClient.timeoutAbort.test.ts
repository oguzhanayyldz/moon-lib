/**
 * Queue deadline (queue.timeout) must abort the request and its retry loop.
 *
 * Defect (before these tests): p-queue 6 with `throwOnTimeout: false` resolved `queue.add`
 * with `undefined` when the deadline passed. makeRequest then threw
 * "Cannot read properties of undefined (reading 'data')" to the caller, while
 * executeRequest kept running in the background and sent the same request again on
 * every retry (a Hepsiburada approve POST went out 3 more times after the caller had
 * already reported failure).
 */
import http from 'http';
import { AddressInfo } from 'net';
import { BaseApiClient } from '../baseApiClient.service';
import { logger } from '../logger.service';
import { ApiRequestTimeoutError } from '../../common/types/api-client.types';

jest.mock('../../utils/authFailureTracker.util', () => ({
    AuthFailureTracker: {
        increment: jest.fn().mockResolvedValue(1),
        reset: jest.fn().mockResolvedValue(undefined),
    }
}));

class TestApiClient extends BaseApiClient {
    public baseUrl = 'https://api.test.local';

    getBaseURL(): string { return this.baseUrl; }
    getDefaultHeaders(): Record<string, string> { return { 'Content-Type': 'application/json' }; }
    async handleRateLimitError(): Promise<void> { /* noop */ }
    // Network errors (no response) and 5xx are retried, like the marketplace clients.
    shouldRetry(error: any): boolean {
        return !error.response || error.response.status >= 500;
    }
    setHttpClient(client: any): void { (this as any).httpClient = client; }
}

interface ClientOptions {
    queueTimeout?: number;
    maxRetries?: number;
    retryDelay?: number;
    maxRetryDelay?: number;
}

function makeClient(opts: ClientOptions = {}): TestApiClient {
    const config: any = {
        rateLimiter: { points: 1000, duration: 1 },
        queue: { concurrency: 5, intervalCap: 1000, interval: 0, timeout: opts.queueTimeout },
        circuitBreaker: {
            failureThreshold: 100,
            resetTimeout: 60000,
            monitoringPeriod: 60000,
            expectedErrors: [],
            fallbackEnabled: false,
            halfOpenMaxCalls: 1
        },
        timeout: 5000,
        retries: {
            maxRetries: opts.maxRetries ?? 3,
            initialDelay: opts.retryDelay ?? 20,
            maxDelay: opts.maxRetryDelay ?? 1000,
            backoffFactor: 1,
            retryableErrors: []
        }
    };
    return new TestApiClient(config, 'test-service', 'Hepsiburada' as any);
}

const REQ = { skipRateLimit: true, logRequest: false };
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function networkError(code = 'ECONNRESET') {
    const err: any = new Error(`socket hang up (${code})`);
    err.code = code;
    err.isAxiosError = true;
    return err;
}

/**
 * Fake transport: each call waits `delayMs`, honours the abort signal like axios does,
 * then runs `outcome(callIndex)`.
 */
function fakeTransport(delayMs: number, outcome: (call: number) => any) {
    const calls: Array<{ signal?: AbortSignal }> = [];
    const request = jest.fn((config: any) => {
        const call = calls.length;
        calls.push({ signal: config.signal });
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                try {
                    resolve(outcome(call));
                } catch (e) {
                    reject(e);
                }
            }, delayMs);
            config.signal?.addEventListener('abort', () => {
                clearTimeout(timer);
                const canceled: any = new Error('canceled');
                canceled.code = 'ERR_CANCELED';
                reject(canceled);
            });
        });
    });
    return { request, calls };
}

describe('BaseApiClient — queue deadline aborts the request and its retries', () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);

    beforeAll(() => process.on('unhandledRejection', onUnhandled));
    afterAll(() => process.off('unhandledRejection', onUnhandled));

    beforeEach(() => {
        unhandled.length = 0;
        jest.spyOn(logger, 'warn').mockImplementation(() => logger);
        jest.spyOn(logger, 'error').mockImplementation(() => logger);
        jest.spyOn(logger, 'info').mockImplementation(() => logger);
        jest.spyOn(logger, 'debug').mockImplementation(() => logger);
    });

    afterEach(() => jest.restoreAllMocks());

    it('slow response: caller gets ApiRequestTimeoutError, exactly one request is sent', async () => {
        const client = makeClient({ queueTimeout: 100, maxRetries: 3, retryDelay: 20 });
        const transport = fakeTransport(300, () => ({ status: 200, data: { ok: true }, headers: {} }));
        client.setHttpClient({ request: transport.request });

        const caught: any = await client.post('/approve', { id: 1 }, REQ).catch((e) => e);

        expect(caught).toBeInstanceOf(ApiRequestTimeoutError);
        expect(caught.code).toBe('ECONNABORTED');
        expect(caught.timeoutMs).toBe(100);
        expect(caught.message).toBe('Hepsiburada API request timed out after 100 ms; request aborted');
        // Command listeners retry whole commands when the message contains "timeout".
        expect(caught.message).not.toContain('timeout');
        expect(caught.message).not.toContain('Cannot read properties');
        expect(caught.message).not.toContain('/approve');

        // Longer than every retry delay combined: no orphan attempt may follow.
        await wait(400);
        expect(transport.request).toHaveBeenCalledTimes(1);
        expect(transport.calls[0].signal?.aborted).toBe(true);
        // The aborted attempt must not even schedule a retry.
        const retryLogs = (logger.info as jest.Mock).mock.calls.filter(([msg]) => String(msg).startsWith('Retrying request'));
        expect(retryLogs).toEqual([]);
        expect(unhandled).toEqual([]);
    });

    it('transport fails just before the deadline: the pending retry is cancelled', async () => {
        // First attempt fails at 80 ms (retryable), retry is scheduled for 80 + 60 = 140 ms,
        // deadline fires at 100 ms while the loop is sleeping.
        const client = makeClient({ queueTimeout: 100, maxRetries: 3, retryDelay: 60 });
        const transport = fakeTransport(80, () => { throw networkError('ECONNABORTED'); });
        client.setHttpClient({ request: transport.request });

        const caught: any = await client.post('/approve', { id: 1 }, REQ).catch((e) => e);
        expect(caught).toBeInstanceOf(ApiRequestTimeoutError);

        await wait(400);
        expect(transport.request).toHaveBeenCalledTimes(1);
        expect(unhandled).toEqual([]);
    });

    it('network error without a deadline: retries still run (1 + maxRetries attempts)', async () => {
        const client = makeClient({ maxRetries: 3, retryDelay: 5 });
        const original = networkError();
        const transport = fakeTransport(1, () => { throw original; });
        client.setHttpClient({ request: transport.request });

        const caught = await client.get('/orders', REQ).catch((e) => e);

        expect(caught).toBe(original);
        expect(transport.request).toHaveBeenCalledTimes(4);
    });

    it('network error within the deadline: retry recovers and returns data', async () => {
        const client = makeClient({ queueTimeout: 1000, maxRetries: 3, retryDelay: 5 });
        const transport = fakeTransport(5, (call) => {
            if (call < 2) throw networkError();
            return { status: 200, data: { ok: call }, headers: {} };
        });
        client.setHttpClient({ request: transport.request });

        await expect(client.get('/orders', REQ)).resolves.toEqual({ ok: 2 });
        expect(transport.request).toHaveBeenCalledTimes(3);
    });

    it('skipRetry: a retryable error is not retried, one request only', async () => {
        const client = makeClient({ maxRetries: 3, retryDelay: 5 });
        const original = networkError();
        const transport = fakeTransport(1, () => { throw original; });
        client.setHttpClient({ request: transport.request });

        const caught = await client.post('/approve', { id: 1 }, { ...REQ, skipRetry: true }).catch((e) => e);

        expect(caught).toBe(original);
        await wait(50);
        expect(transport.request).toHaveBeenCalledTimes(1);
    });

    it('fast response under a deadline: data is returned and the request is not aborted', async () => {
        const client = makeClient({ queueTimeout: 200 });
        const transport = fakeTransport(5, () => ({ status: 200, data: { ok: true }, headers: {} }));
        client.setHttpClient({ request: transport.request });

        await expect(client.get('/orders', REQ)).resolves.toEqual({ ok: true });
        await wait(250);
        expect(transport.calls[0].signal?.aborted).toBe(false);
        expect(unhandled).toEqual([]);
    });

    describe('per-call timeout longer than queue.timeout (fake clock)', () => {
        // Hepsiburada/idefix product uploads pass `timeout: 60000` on a client whose
        // queue.timeout is 30000. The call deadline must follow the longer request timeout.
        beforeEach(() => jest.useFakeTimers());
        afterEach(() => jest.useRealTimers());

        function settleState<T>(promise: Promise<T>) {
            const state: { settled: boolean; value?: T; error?: any } = { settled: false };
            promise.then(
                (value) => { state.settled = true; state.value = value; },
                (error) => { state.settled = true; state.error = error; }
            );
            return state;
        }

        it('60 s call on a 30 s queue is not cut at 30 s and completes', async () => {
            const client = makeClient({ queueTimeout: 30000 });
            const transport = fakeTransport(45000, () => ({ status: 200, data: { uploaded: true }, headers: {} }));
            client.setHttpClient({ request: transport.request });

            const state = settleState(client.post('/products/import', {}, { ...REQ, timeout: 60000 }));

            await jest.advanceTimersByTimeAsync(30001);
            expect(state.settled).toBe(false);
            expect(transport.calls[0].signal?.aborted).toBe(false);

            await jest.advanceTimersByTimeAsync(15000);
            expect(state).toEqual({ settled: true, value: { uploaded: true } });
            expect(transport.request).toHaveBeenCalledTimes(1);
        });

        it('60 s call is aborted at 60 s with the 60 s deadline, without a retry', async () => {
            const client = makeClient({ queueTimeout: 30000, maxRetries: 3, retryDelay: 1000 });
            const transport = fakeTransport(90000, () => ({ status: 200, data: {}, headers: {} }));
            client.setHttpClient({ request: transport.request });

            const state = settleState(client.post('/products/import', {}, { ...REQ, timeout: 60000 }));

            await jest.advanceTimersByTimeAsync(59999);
            expect(state.settled).toBe(false);

            await jest.advanceTimersByTimeAsync(1);
            expect(state.error).toBeInstanceOf(ApiRequestTimeoutError);
            expect(state.error.timeoutMs).toBe(60000);
            expect(transport.calls[0].signal?.aborted).toBe(true);

            await jest.advanceTimersByTimeAsync(60000);
            expect(transport.request).toHaveBeenCalledTimes(1);
        });

        it('call without its own timeout is still aborted at the 30 s queue deadline', async () => {
            const client = makeClient({ queueTimeout: 30000 });
            const transport = fakeTransport(45000, () => ({ status: 200, data: {}, headers: {} }));
            client.setHttpClient({ request: transport.request });

            const state = settleState(client.get('/orders', REQ));

            await jest.advanceTimersByTimeAsync(29999);
            expect(state.settled).toBe(false);

            await jest.advanceTimersByTimeAsync(1);
            expect(state.error).toBeInstanceOf(ApiRequestTimeoutError);
            expect(state.error.timeoutMs).toBe(30000);
            expect(transport.calls[0].signal?.aborted).toBe(true);
        });

        it('a per-call timeout shorter than queue.timeout does not shorten the deadline', async () => {
            const client = makeClient({ queueTimeout: 30000 });
            const transport = fakeTransport(20000, () => ({ status: 200, data: { ok: true }, headers: {} }));
            client.setHttpClient({ request: transport.request });

            const state = settleState(client.get('/orders', { ...REQ, timeout: 10000 }));

            await jest.advanceTimersByTimeAsync(20000);
            expect(state).toEqual({ settled: true, value: { ok: true } });
        });

        it('deadline during a retry delay: executeRequest settles at the deadline, not after the delay', async () => {
            // Attempt 1 fails at 25 s, the retry sleep would last until 35 s; deadline is 30 s.
            const client = makeClient({ queueTimeout: 30000, maxRetries: 3, retryDelay: 10000, maxRetryDelay: 10000 });
            client.setHttpClient({ request: fakeTransport(25000, () => { throw networkError(); }).request });
            const executeSpy = jest.spyOn(client as any, 'executeRequest');

            const caller = settleState(client.get('/orders', REQ));
            await jest.advanceTimersByTimeAsync(25000);
            const inner = settleState(executeSpy.mock.results[0].value as Promise<unknown>);

            await jest.advanceTimersByTimeAsync(5000);
            expect(caller.error).toBeInstanceOf(ApiRequestTimeoutError);
            // The retry sleep is cancelled by the abort; the breaker slot is released now.
            expect(inner.settled).toBe(true);
        });

        it('a deadline abort is logged as 504, not as a generic 500', async () => {
            const client = makeClient({ queueTimeout: 30000 });
            client.setHttpClient({ request: fakeTransport(45000, () => ({ status: 200, data: {}, headers: {} })).request });
            const logService = {
                logRequest: jest.fn().mockResolvedValue('log-1'),
                logResponse: jest.fn().mockResolvedValue(undefined),
            };
            (client as any).logService = logService;

            const state = settleState(client.get('/orders', { skipRateLimit: true }));
            await jest.advanceTimersByTimeAsync(30000);

            expect(state.error).toBeInstanceOf(ApiRequestTimeoutError);
            expect(logService.logResponse).toHaveBeenCalledWith('log-1', expect.objectContaining({ responseStatus: 504 }));
        });

        it('fast failure clears the deadline timer', async () => {
            const client = makeClient({ queueTimeout: 30000 });
            const badRequest: any = new Error('Request failed with status code 400');
            badRequest.response = { status: 400, data: {}, headers: {} };
            client.setHttpClient({ request: fakeTransport(10, () => { throw badRequest; }).request });

            const state = settleState(client.get('/orders', REQ));
            await jest.advanceTimersByTimeAsync(10);

            expect(state.error).toBe(badRequest);
            expect(jest.getTimerCount()).toBe(0);
        });
    });

    describe('with real axios against a local HTTP server', () => {
        let server: http.Server;
        let hits = 0;
        let closedEarly = 0;

        beforeAll(async () => {
            server = http.createServer((req, res) => {
                hits++;
                const timer = setTimeout(() => {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end('{"ok":true}');
                }, 400);
                req.socket.on('close', () => {
                    if (!res.writableEnded) {
                        closedEarly++;
                        clearTimeout(timer);
                    }
                });
            });
            await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        });

        afterAll(async () => {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        });

        it('deadline cancels the socket and no retry reaches the server', async () => {
            const client = makeClient({ queueTimeout: 150, maxRetries: 3, retryDelay: 20 });
            client.baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
            client.reconfigureHttpClient();

            const caught = await client.post('/approve', { id: 1 }, REQ).catch((e) => e);
            expect(caught).toBeInstanceOf(ApiRequestTimeoutError);

            await wait(600);
            expect(hits).toBe(1);
            expect(closedEarly).toBe(1);
            expect(unhandled).toEqual([]);
        });
    });
});
