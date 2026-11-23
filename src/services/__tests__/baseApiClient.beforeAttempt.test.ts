/**
 * UC-2275 (Exxe UC-2266 B-3): `beforeRequestAttempt` runs before EVERY HTTP attempt, retries included.
 *
 * Defect: Hepsiburada took its per-IP minute quota once in makeRequest. The retry loop in
 * executeRequest (429/5xx, Retry-After 403) sent up to 3 more requests to HB that the quota never
 * counted, so in an error storm the real request rate could pass 180/min. A per-attempt hook lets
 * the subclass count every request that actually leaves the process.
 */
import { BaseApiClient } from '../baseApiClient.service';
import { logger } from '../logger.service';
import { ApiRequestTimeoutError } from '../../common/types/api-client.types';
import { RequestConfig } from '../../common/interfaces/api-client.interface';

jest.mock('../../utils/authFailureTracker.util', () => ({
    AuthFailureTracker: {
        increment: jest.fn().mockResolvedValue(1),
        reset: jest.fn().mockResolvedValue(undefined),
    }
}));

type Hook = (config: RequestConfig, signal?: AbortSignal) => Promise<void>;

class HookedClient extends BaseApiClient {
    public hook: Hook = async () => undefined;

    getBaseURL(): string { return 'https://api.test.local'; }
    getDefaultHeaders(): Record<string, string> { return {}; }
    async handleRateLimitError(): Promise<void> { /* noop */ }
    shouldRetry(error: any): boolean {
        return !error.response || error.response.status >= 500;
    }
    protected beforeRequestAttempt(config: RequestConfig, signal?: AbortSignal): Promise<void> {
        return this.hook(config, signal);
    }
    setHttpClient(client: any): void { (this as any).httpClient = client; }
}

function makeClient(opts: { queueTimeout?: number; maxRetries?: number } = {}): HookedClient {
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
        retries: { maxRetries: opts.maxRetries ?? 3, initialDelay: 5, maxDelay: 10, backoffFactor: 1, retryableErrors: [] }
    };
    return new HookedClient(config, 'test-service', 'Hepsiburada' as any);
}

const REQ = { skipRateLimit: true, logRequest: false };

function serverError(status = 503) {
    const err: any = new Error(`HTTP ${status}`);
    err.isAxiosError = true;
    err.response = { status, headers: {}, data: {} };
    return err;
}

describe('BaseApiClient.beforeRequestAttempt (UC-2275 B-3)', () => {
    beforeEach(() => {
        jest.spyOn(logger, 'warn').mockImplementation(() => logger);
        jest.spyOn(logger, 'error').mockImplementation(() => logger);
        jest.spyOn(logger, 'info').mockImplementation(() => logger);
        jest.spyOn(logger, 'debug').mockImplementation(() => logger);
    });
    afterEach(() => jest.restoreAllMocks());

    it('runs once per HTTP attempt: 2 × 503 then 200 → 3 hook calls, 3 requests, hook always first', async () => {
        const client = makeClient();
        const order: string[] = [];
        client.hook = async () => { order.push('hook'); };
        let call = 0;
        client.setHttpClient({
            request: jest.fn(async () => {
                order.push('http');
                if (call++ < 2) throw serverError();
                return { status: 200, data: { ok: true }, headers: {} };
            })
        });

        await expect(client.get('/x', REQ)).resolves.toEqual({ ok: true });

        expect(order).toEqual(['hook', 'http', 'hook', 'http', 'hook', 'http']);
    });

    it('hook receives the request config and the deadline abort signal', async () => {
        const client = makeClient({ queueTimeout: 1000 });
        const seen: Array<{ url?: string; signal?: AbortSignal }> = [];
        client.hook = async (config, signal) => { seen.push({ url: config.url, signal }); };
        client.setHttpClient({ request: jest.fn(async () => ({ status: 200, data: {}, headers: {} })) });

        await client.get('/products/1', REQ);

        expect(seen).toHaveLength(1);
        expect(seen[0].url).toBe('/products/1');
        expect(seen[0].signal).toBeInstanceOf(AbortSignal);
    });

    it('hook failure: nothing is sent, the error reaches the caller and is not retried', async () => {
        const client = makeClient({ maxRetries: 3 });
        const refusal: any = new Error('quota wait aborted');
        refusal.code = 'QUOTA_WAIT_ABORTED';
        const hook = jest.fn(async () => { throw refusal; });
        client.hook = hook;
        const request = jest.fn(async () => ({ status: 200, data: {}, headers: {} }));
        client.setHttpClient({ request });

        await expect(client.get('/x', REQ)).rejects.toBe(refusal);

        expect(hook).toHaveBeenCalledTimes(1);
        expect(request).not.toHaveBeenCalled();
    });

    it('hook wait counts toward the deadline: a hook that outlives it sends nothing', async () => {
        const client = makeClient({ queueTimeout: 50 });
        client.hook = (_config, signal) => new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, 300);
            signal?.addEventListener('abort', () => { clearTimeout(timer); resolve(); });
        });
        const request = jest.fn(async () => ({ status: 200, data: {}, headers: {} }));
        client.setHttpClient({ request });

        await expect(client.get('/x', REQ)).rejects.toBeInstanceOf(ApiRequestTimeoutError);
        await new Promise((r) => setTimeout(r, 350));

        expect(request).not.toHaveBeenCalled();
    });
});
