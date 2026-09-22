import { CircuitBreaker } from '../circuitBreaker.service';
import { BaseApiClient } from '../baseApiClient.service';
import { OperationType } from '../../enums/operation-type.enum';
import { CircuitBreakerConfig, CircuitBreakerOpenError, CircuitBreakerState } from '../../common/types/api-client.types';

// A failure that is NOT an expected error (4xx, e.g. 429 once a client removes it from
// expectedErrors) takes a half-open slot like any other call. These tests pin that the slot is
// given back, so such failures can never leave the breaker stuck in HALF_OPEN with no calls allowed.

const RESET_TIMEOUT = 60_000;

const httpError = (status: number) => ({ response: { status }, message: `HTTP ${status}`, isAxiosError: true });

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}

describe('CircuitBreaker — half-open slot accounting', () => {
    let now: number;

    beforeEach(() => {
        now = 1_000_000;
        jest.spyOn(Date, 'now').mockImplementation(() => now);
    });

    afterEach(() => jest.restoreAllMocks());

    function makeBreaker(halfOpenMaxCalls: number): CircuitBreaker {
        const config: CircuitBreakerConfig = {
            failureThreshold: 2,
            resetTimeout: RESET_TIMEOUT,
            monitoringPeriod: RESET_TIMEOUT,
            expectedErrors: [],
            fallbackEnabled: false,
            halfOpenMaxCalls
        };
        return new CircuitBreaker(config, 'test-service');
    }

    async function openThenWait(breaker: CircuitBreaker): Promise<void> {
        for (let i = 0; i < 2; i++) {
            await expect(breaker.execute(() => Promise.reject(httpError(503)))).rejects.toMatchObject({ response: { status: 503 } });
        }
        expect(breaker.getCurrentState()).toBe(CircuitBreakerState.OPEN);
        now += RESET_TIMEOUT + 1;
    }

    it.each([429, 400])('two %i responses in HALF_OPEN do not lock the breaker; the next call still reaches the server', async (status) => {
        const breaker = makeBreaker(2);
        await openThenWait(breaker);

        // Both half-open slots end in a non-counted failure; the caller gets the server error.
        for (let i = 0; i < 2; i++) {
            await expect(breaker.execute(() => Promise.reject(httpError(status)))).rejects.toMatchObject({ response: { status } });
        }
        // A non-counted failure neither closes nor reopens the breaker.
        expect(breaker.getCurrentState()).toBe(CircuitBreakerState.HALF_OPEN);

        // An hour later the server is healthy: the call must be sent, not rejected by the breaker.
        now += 60 * 60 * 1000;
        const fn = jest.fn().mockResolvedValue('ok');
        await expect(breaker.execute(fn)).resolves.toBe('ok');
        expect(fn).toHaveBeenCalledTimes(1);
        expect(breaker.getCurrentState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('still limits concurrent half-open calls to halfOpenMaxCalls', async () => {
        const breaker = makeBreaker(1);
        await openThenWait(breaker);

        const probe = deferred<string>();
        const inFlight = breaker.execute(() => probe.promise);

        // The only slot is taken by the in-flight probe.
        const second = jest.fn().mockResolvedValue('second');
        await expect(breaker.execute(second)).rejects.toBeInstanceOf(CircuitBreakerOpenError);
        expect(second).not.toHaveBeenCalled();

        // The probe ends in a non-counted failure and releases its slot.
        probe.reject(httpError(429));
        await expect(inFlight).rejects.toMatchObject({ response: { status: 429 } });

        const third = jest.fn().mockResolvedValue('third');
        await expect(breaker.execute(third)).resolves.toBe('third');
        expect(breaker.getCurrentState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('a call that did not take a half-open slot does not release one', async () => {
        const breaker = makeBreaker(1);

        // Started while CLOSED, so it holds no half-open slot.
        const early = deferred<string>();
        const earlyCall = breaker.execute(() => early.promise);

        await openThenWait(breaker);

        // The next call moves the breaker to HALF_OPEN and takes the only slot.
        const probe = deferred<string>();
        const probeCall = breaker.execute(() => probe.promise);
        expect(breaker.getCurrentState()).toBe(CircuitBreakerState.HALF_OPEN);

        // The early call now fails with a non-counted error; the probe's slot must stay taken.
        early.reject(httpError(400));
        await expect(earlyCall).rejects.toMatchObject({ response: { status: 400 } });

        const extra = jest.fn().mockResolvedValue('extra');
        await expect(breaker.execute(extra)).rejects.toBeInstanceOf(CircuitBreakerOpenError);
        expect(extra).not.toHaveBeenCalled();

        probe.resolve('ok');
        await expect(probeCall).resolves.toBe('ok');
        expect(breaker.getCurrentState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('a slot released after its half-open round ended cannot raise the limit', async () => {
        const breaker = makeBreaker(2);
        await openThenWait(breaker);

        // Round 1: a slow probe stays in flight while a second probe reopens the breaker.
        const slow = deferred<string>();
        const slowCall = breaker.execute(() => slow.promise);
        await expect(breaker.execute(() => Promise.reject(httpError(503)))).rejects.toMatchObject({ response: { status: 503 } });
        expect(breaker.getCurrentState()).toBe(CircuitBreakerState.OPEN);

        // Round 2: one probe ends in a non-counted failure, then the slow round-1 probe does too.
        now += RESET_TIMEOUT + 1;
        await expect(breaker.execute(() => Promise.reject(httpError(400)))).rejects.toMatchObject({ response: { status: 400 } });
        slow.reject(httpError(400));
        await expect(slowCall).rejects.toMatchObject({ response: { status: 400 } });

        // Still at most two probes in flight.
        const probes = [deferred<string>(), deferred<string>()];
        const inFlight = probes.map((p) => breaker.execute(() => p.promise));
        const third = jest.fn().mockResolvedValue('third');
        await expect(breaker.execute(third)).rejects.toBeInstanceOf(CircuitBreakerOpenError);
        expect(third).not.toHaveBeenCalled();

        probes.forEach((p) => p.resolve('ok'));
        await expect(Promise.all(inFlight)).resolves.toEqual(['ok', 'ok']);
    });

    it('an expected failure in HALF_OPEN still reopens the breaker', async () => {
        const breaker = makeBreaker(2);
        await openThenWait(breaker);

        await expect(breaker.execute(() => Promise.reject(httpError(503)))).rejects.toMatchObject({ response: { status: 503 } });
        expect(breaker.getCurrentState()).toBe(CircuitBreakerState.OPEN);

        const fn = jest.fn().mockResolvedValue('ok');
        await expect(breaker.execute(fn)).rejects.toBeInstanceOf(CircuitBreakerOpenError);
        expect(fn).not.toHaveBeenCalled();
    });
});

class TestApiClient extends BaseApiClient {
    getBaseURL(): string { return 'https://api.test.local'; }
    getDefaultHeaders(): Record<string, string> { return { 'Content-Type': 'application/json' }; }
    async handleRateLimitError(): Promise<void> { /* noop */ }
    shouldRetry(): boolean { return false; }
    setHttpClient(client: any): void { (this as any).httpClient = client; }
}

describe('BaseApiClient — half-open breaker after non-counted failures', () => {
    let now: number;

    beforeEach(() => {
        now = 1_000_000;
        jest.spyOn(Date, 'now').mockImplementation(() => now);
    });

    afterEach(() => jest.restoreAllMocks());

    it.each([429, 400])('two %i responses on the half-open OTHER breaker do not block later requests', async (status) => {
        let next: 'fail' | 'status' | 'ok' = 'fail';
        const httpRequest = jest.fn(async (cfg: any) => {
            if (next === 'fail') throw httpError(503);
            if (next === 'status') throw httpError(status);
            return { data: { ok: true }, status: 200, headers: {}, config: cfg };
        });
        const config: any = {
            rateLimiter: { points: 1000, duration: 1 },
            queue: { concurrency: 5, intervalCap: 1000, interval: 0 },
            circuitBreaker: {
                failureThreshold: 2,
                resetTimeout: RESET_TIMEOUT,
                monitoringPeriod: RESET_TIMEOUT,
                expectedErrors: [],
                fallbackEnabled: false,
                halfOpenMaxCalls: 2
            },
            timeout: 5000
        };
        const client = new TestApiClient(config, 'test-service', 'Amazon' as any);
        client.setHttpClient({ request: httpRequest });
        const REQ = { skipRateLimit: true, logRequest: false };

        await expect(client.get('/x', REQ)).rejects.toBeDefined();
        await expect(client.get('/x', REQ)).rejects.toBeDefined();
        expect(client.getCircuitBreakerMetrics(OperationType.OTHER).state).toBe(CircuitBreakerState.OPEN);

        now += RESET_TIMEOUT + 1;
        next = 'status';
        await expect(client.get('/x', REQ)).rejects.not.toBeInstanceOf(CircuitBreakerOpenError);
        await expect(client.get('/x', REQ)).rejects.not.toBeInstanceOf(CircuitBreakerOpenError);

        now += 60 * 60 * 1000;
        next = 'ok';
        const sentBefore = httpRequest.mock.calls.length;
        await expect(client.get<{ ok: boolean }>('/x', REQ)).resolves.toEqual({ ok: true });
        expect(httpRequest.mock.calls.length).toBe(sentBefore + 1);
        expect(client.getCircuitBreakerMetrics(OperationType.OTHER).state).toBe(CircuitBreakerState.CLOSED);
    });
});
