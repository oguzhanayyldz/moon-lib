/**
 * handleCustomError bir SINIFLANDIRMA kancasidir, log kancasi degil.
 *
 * Kusur (bu testlerden once): makeRequest, handleCustomError'in firlattigi hatayi
 * try/catch ile yutuyor, yerine sahte bir `warn('Custom error handler failed')`
 * basiyor ve ORIJINAL axios hatasini firlatiyordu. Sonuc:
 *   1. Entegrasyonlarin tipli hata taksonomisi (ornegin HepsiJetApiError) cagirana
 *      HIC ulasmiyordu — olu kod.
 *   2. Kancasi throw eden her entegrasyonda BASARISIZ HER ISTEK bir sahte warn uretiyordu.
 */
import { BaseApiClient } from '../baseApiClient.service';
import { logger } from '../logger.service';

jest.mock('../../utils/authFailureTracker.util', () => ({
    AuthFailureTracker: {
        increment: jest.fn().mockResolvedValue(1),
        reset: jest.fn().mockResolvedValue(undefined),
    }
}));

class TypedError extends Error {
    constructor(public readonly kind: string, public readonly statusCode: number) {
        super(`typed:${kind}`);
        this.name = 'TypedError';
        Object.setPrototypeOf(this, TypedError.prototype);
    }
}

/** handleCustomError'i test basina degistirilebilir yapan concrete subclass. */
class TestApiClient extends BaseApiClient {
    public customHandler: ((error: any) => void) | undefined;

    getBaseURL(): string { return 'https://api.test.local'; }
    getDefaultHeaders(): Record<string, string> { return { 'Content-Type': 'application/json' }; }
    async handleRateLimitError(): Promise<void> { /* noop */ }
    shouldRetry(): boolean { return false; }
    setHttpClient(client: any): void { (this as any).httpClient = client; }

    protected handleCustomError(error: any): void {
        if (this.customHandler) { this.customHandler(error); }
    }
}

function makeClient(httpRequest: jest.Mock): TestApiClient {
    const config: any = {
        rateLimiter: { points: 1000, duration: 1 },
        queue: { concurrency: 5, intervalCap: 1000, interval: 0 },
        circuitBreaker: {
            failureThreshold: 100,
            resetTimeout: 60000,
            monitoringPeriod: 60000,
            expectedErrors: [],
            fallbackEnabled: false,
            halfOpenMaxCalls: 1
        },
        timeout: 5000
    };
    const client = new TestApiClient(config, 'test-service', 'Trendyol' as any);
    client.setHttpClient({ request: httpRequest });
    return client;
}

const REQ = { skipRateLimit: true, logRequest: false };

/** Gercek axios hata sekli: .response / .config tasir. */
function axiosError(status: number, data: any = { message: 'bad request' }) {
    const err: any = new Error(`Request failed with status code ${status}`);
    err.isAxiosError = true;
    err.response = { status, statusText: 'ERR', data, headers: {} };
    err.config = { url: '/orders', method: 'get' };
    return err;
}

describe('BaseApiClient — handleCustomError siniflandirma kancasi', () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => logger);
        jest.spyOn(logger, 'error').mockImplementation(() => logger);
    });

    afterEach(() => jest.restoreAllMocks());

    it('kancanin firlattigi TIPLI hata cagirana ULASIR (yutulmaz)', async () => {
        const original = axiosError(401);
        const client = makeClient(jest.fn().mockRejectedValue(original));
        client.customHandler = () => { throw new TypedError('AUTH_ERROR', 401); };

        const caught = await client.get('/orders', REQ).then(
            () => { throw new Error('istek basarili olmamaliydi'); },
            (e) => e
        );

        expect(caught).toBeInstanceOf(TypedError);
        expect((caught as TypedError).kind).toBe('AUTH_ERROR');
        expect((caught as TypedError).statusCode).toBe(401);
    });

    it('tipli hata ORIJINAL axios hatasini `cause` olarak tasir', async () => {
        const original = axiosError(500);
        const client = makeClient(jest.fn().mockRejectedValue(original));
        client.customHandler = () => { throw new TypedError('API_ERROR', 500); };

        const caught: any = await client.get('/orders', REQ).catch((e) => e);

        expect(caught.cause).toBe(original);
        expect(caught.cause.response.status).toBe(500);
    });

    it('kanca ZATEN cause atadiysa uzerine YAZILMAZ', async () => {
        const original = axiosError(503);
        const preset = new Error('onceden zincirlenmis');
        const client = makeClient(jest.fn().mockRejectedValue(original));
        client.customHandler = () => {
            const e: any = new TypedError('API_ERROR', 503);
            e.cause = preset;
            throw e;
        };

        const caught: any = await client.get('/orders', REQ).catch((e) => e);

        expect(caught.cause).toBe(preset);
    });

    it('kanca ORIJINAL hatayi yeniden firlatirsa cagiran .response okuyabilir (409 zinciri)', async () => {
        // hepsiburada/idefix'in ALREADY_PACKAGED zinciri `error.response?.status` okur.
        const original = axiosError(409, { message: 'already packaged' });
        const client = makeClient(jest.fn().mockRejectedValue(original));
        client.customHandler = (error) => { throw error; };

        const caught: any = await client.get('/packages', REQ).catch((e) => e);

        expect(caught).toBe(original);
        expect(caught.response?.status).toBe(409);
        // Kendini `cause` yapmaz (dongusel zincir olusmaz).
        expect(caught.cause).toBeUndefined();
    });

    it('kanca throw ETMEZSE orijinal hata firlatilir (geriye donuk uyum)', async () => {
        const original = axiosError(418);
        const client = makeClient(jest.fn().mockRejectedValue(original));
        client.customHandler = () => { /* sadece loglar */ };

        const caught: any = await client.get('/orders', REQ).catch((e) => e);

        expect(caught).toBe(original);
    });

    it('SAHTE "Custom error handler failed" warn\'i artik BASILMAZ', async () => {
        const client = makeClient(jest.fn().mockRejectedValue(axiosError(400)));
        client.customHandler = () => { throw new TypedError('VALIDATION_ERROR', 400); };

        await client.get('/orders', REQ).catch(() => undefined);

        const bogus = warnSpy.mock.calls.filter((c) => String(c[0]).includes('Custom error handler failed'));
        expect(bogus).toHaveLength(0);
    });

    it('GURULTU OLCUMU: 10 basarisiz istek 0 sahte warn uretir', async () => {
        const client = makeClient(jest.fn().mockRejectedValue(axiosError(400)));
        client.customHandler = () => { throw new TypedError('VALIDATION_ERROR', 400); };

        for (let i = 0; i < 10; i++) {
            await client.get('/orders', REQ).catch(() => undefined);
        }

        const bogus = warnSpy.mock.calls.filter((c) => String(c[0]).includes('Custom error handler failed'));
        expect(bogus).toHaveLength(0);
    });

    it('kanca Error OLMAYAN bir deger firlatirsa da cagirana ulasir', async () => {
        const client = makeClient(jest.fn().mockRejectedValue(axiosError(400)));
        client.customHandler = () => { throw 'ham-string-hata'; };

        const caught: any = await client.get('/orders', REQ).catch((e) => e);

        expect(caught).toBe('ham-string-hata');
    });
});
