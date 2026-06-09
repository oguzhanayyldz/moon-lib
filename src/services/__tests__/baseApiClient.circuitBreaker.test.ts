import { BaseApiClient } from '../baseApiClient.service';
import { OperationType } from '../../enums/operation-type.enum';
import { CircuitBreakerState, CircuitBreakerOpenError } from '../../common/types/api-client.types';

// AuthFailureTracker'i mock'la — Redis'e dokunmadan operation-aware auth cagrilarini dogrula
jest.mock('../../utils/authFailureTracker.util', () => ({
    AuthFailureTracker: {
        increment: jest.fn().mockResolvedValue(1),
        reset: jest.fn().mockResolvedValue(undefined),
    }
}));
import { AuthFailureTracker } from '../../utils/authFailureTracker.util';

// Test-only concrete subclass
class TestApiClient extends BaseApiClient {
    getBaseURL(): string { return 'https://api.test.local'; }
    getDefaultHeaders(): Record<string, string> { return { 'Content-Type': 'application/json' }; }
    async handleRateLimitError(): Promise<void> { /* noop */ }
    shouldRetry(): boolean { return false; }
    setHttpClient(client: any): void { (this as any).httpClient = client; }
}

function makeClient(httpRequest: jest.Mock, authTracking = false): TestApiClient {
    const config: any = {
        rateLimiter: { points: 1000, duration: 1 },
        queue: { concurrency: 5, intervalCap: 1000, interval: 1000 },
        circuitBreaker: {
            failureThreshold: 2,
            resetTimeout: 60000,
            monitoringPeriod: 60000,
            expectedErrors: [],
            fallbackEnabled: false,
            halfOpenMaxCalls: 1
        },
        timeout: 5000,
        ...(authTracking
            ? { authFailureTracking: { userId: 'u1', integrationId: 'i1', integrationName: 'test' } }
            : {})
    };
    const client = new TestApiClient(config, 'test-service', 'Trendyol' as any);
    client.setHttpClient({ request: httpRequest });
    return client;
}

const REQ = { skipRateLimit: true, logRequest: false };

describe('BaseApiClient — per-operation circuit breaker (#566)', () => {
    beforeEach(() => jest.clearAllMocks());

    it('opens ONLY the failing operation breaker; other operations keep working', async () => {
        const httpRequest = jest.fn(async (cfg: any) => {
            if (cfg.operationType === OperationType.FETCH_INVOICES) {
                throw { response: { status: 500 }, message: 'boom', isAxiosError: true };
            }
            return { data: { ok: true }, status: 200, headers: {}, config: cfg };
        });
        const client = makeClient(httpRequest);

        // FETCH_INVOICES iki kez 500 → kendi devresi OPEN olur (failureThreshold=2)
        await expect(client.get('/invoices', { ...REQ, operationType: OperationType.FETCH_INVOICES })).rejects.toBeDefined();
        await expect(client.get('/invoices', { ...REQ, operationType: OperationType.FETCH_INVOICES })).rejects.toBeDefined();

        // 3. cagri httpClient'a HIC ulasmadan CircuitBreakerOpenError ile reddedilir
        await expect(client.get('/invoices', { ...REQ, operationType: OperationType.FETCH_INVOICES }))
            .rejects.toBeInstanceOf(CircuitBreakerOpenError);

        // FETCH_ORDERS hala calisir (izole breaker)
        const res = await client.get<{ ok: boolean }>('/orders', { ...REQ, operationType: OperationType.FETCH_ORDERS });
        expect(res).toEqual({ ok: true });

        // httpClient: 2 basarisiz invoice + 1 basarili order = 3 (3. invoice cagrisi breaker'da kaldi)
        expect(httpRequest).toHaveBeenCalledTimes(3);

        // Metrikler: invoices OPEN, orders CLOSED
        expect(client.getCircuitBreakerMetrics(OperationType.FETCH_INVOICES).state).toBe(CircuitBreakerState.OPEN);
        expect(client.getCircuitBreakerMetrics(OperationType.FETCH_ORDERS).state).toBe(CircuitBreakerState.CLOSED);
    });

    it('aggregate getCircuitBreakerMetrics() reports OPEN if any operation breaker is OPEN', async () => {
        const httpRequest = jest.fn(async (cfg: any) => {
            if (cfg.operationType === OperationType.FETCH_INVOICES) {
                throw { response: { status: 503 }, message: 'unavailable', isAxiosError: true };
            }
            return { data: {}, status: 200, headers: {}, config: cfg };
        });
        const client = makeClient(httpRequest);

        await client.get('/orders', { ...REQ, operationType: OperationType.FETCH_ORDERS });
        await expect(client.get('/invoices', { ...REQ, operationType: OperationType.FETCH_INVOICES })).rejects.toBeDefined();
        await expect(client.get('/invoices', { ...REQ, operationType: OperationType.FETCH_INVOICES })).rejects.toBeDefined();

        expect(client.getCircuitBreakerMetrics().state).toBe(CircuitBreakerState.OPEN);

        const byOp = client.getCircuitBreakerMetricsByOperation();
        expect(byOp[OperationType.FETCH_INVOICES].state).toBe(CircuitBreakerState.OPEN);
        expect(byOp[OperationType.FETCH_ORDERS].state).toBe(CircuitBreakerState.CLOSED);
    });

    it('resetCircuitBreaker(operationType) resets only that operation', async () => {
        const httpRequest = jest.fn(async () => {
            throw { response: { status: 500 }, message: 'boom', isAxiosError: true };
        });
        const client = makeClient(httpRequest);

        await expect(client.get('/x', { ...REQ, operationType: OperationType.FETCH_INVOICES })).rejects.toBeDefined();
        await expect(client.get('/x', { ...REQ, operationType: OperationType.FETCH_INVOICES })).rejects.toBeDefined();
        expect(client.getCircuitBreakerMetrics(OperationType.FETCH_INVOICES).state).toBe(CircuitBreakerState.OPEN);

        client.resetCircuitBreaker(OperationType.FETCH_INVOICES);
        expect(client.getCircuitBreakerMetrics(OperationType.FETCH_INVOICES).state).toBe(CircuitBreakerState.CLOSED);
    });

    it('requests without operationType fall back to the OTHER bucket (backward compat)', async () => {
        const httpRequest = jest.fn(async (cfg: any) => ({ data: { ok: true }, status: 200, headers: {}, config: cfg }));
        const client = makeClient(httpRequest);

        await client.get('/x', { ...REQ });

        const byOp = client.getCircuitBreakerMetricsByOperation();
        expect(byOp[OperationType.OTHER]).toBeDefined();
        expect(byOp[OperationType.OTHER].state).toBe(CircuitBreakerState.CLOSED);
    });
});

describe('BaseApiClient — operation-aware auth tracking (#566)', () => {
    beforeEach(() => jest.clearAllMocks());

    it('increments the auth counter with the failing operationType on 401', async () => {
        const httpRequest = jest.fn(async (cfg: any) => {
            if (cfg.operationType === OperationType.FETCH_INVOICES) {
                throw { response: { status: 401 }, message: 'unauthorized', isAxiosError: true };
            }
            return { data: { ok: true }, status: 200, headers: {}, config: cfg };
        });
        const client = makeClient(httpRequest, true);

        await expect(client.get('/invoices', { ...REQ, operationType: OperationType.FETCH_INVOICES })).rejects.toBeDefined();

        expect(AuthFailureTracker.increment).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'u1', integrationId: 'i1', integrationName: 'test' }),
            401,
            expect.any(String),
            OperationType.FETCH_INVOICES
        );
    });

    it('resets ONLY the successful operation counter on success', async () => {
        const httpRequest = jest.fn(async (cfg: any) => ({ data: { ok: true }, status: 200, headers: {}, config: cfg }));
        const client = makeClient(httpRequest, true);

        await client.get('/orders', { ...REQ, operationType: OperationType.FETCH_ORDERS });

        expect(AuthFailureTracker.reset).toHaveBeenCalledWith('u1', 'i1', OperationType.FETCH_ORDERS);
    });

    it('does NOT count 5xx errors as auth failures', async () => {
        const httpRequest = jest.fn(async () => {
            throw { response: { status: 500 }, message: 'server error', isAxiosError: true };
        });
        const client = makeClient(httpRequest, true);

        await expect(client.get('/x', { ...REQ, operationType: OperationType.FETCH_ORDERS })).rejects.toBeDefined();

        expect(AuthFailureTracker.increment).not.toHaveBeenCalled();
    });
});
