import { BaseApiClient } from '../baseApiClient.service';
import { OperationType } from '../../enums/operation-type.enum';

/**
 * Issue #604 — Servis-grubu farkindalikli rate limiting testleri.
 *
 * Senaryo: Trendyol'un 14 Eylul 2026 limit modeli. Limitler tekil endpoint yerine
 * servis GRUBU bazinda uygulanir; ayni gruptaki endpoint'ler ortak kotayi tuketir.
 */

// Grup cozumleyen test istemcisi — gercek entegrasyonlarin override edecegi yapinin ayni
class GroupedTestApiClient extends BaseApiClient {
    getBaseURL(): string { return 'https://api.test.local'; }
    getDefaultHeaders(): Record<string, string> { return { 'Content-Type': 'application/json' }; }
    async handleRateLimitError(): Promise<void> { /* noop */ }
    shouldRetry(): boolean { return false; }
    setHttpClient(client: any): void { (this as any).httpClient = client; }

    protected resolveRateLimitGroup(operationType: OperationType | string): string | undefined {
        switch (operationType) {
            case OperationType.FETCH_PRODUCTS:
            case OperationType.GET_CATEGORY_ATTRIBUTES:
                return 'read';
            case OperationType.SEND_PRODUCTS:
                return 'write';
            case OperationType.UPDATE_STOCK_AND_PRICE:
                // Bilerek config'de TANIMSIZ grup — ortak limiter'a dusmeli
                return 'tanimsiz-grup';
            default:
                return undefined;
        }
    }
}

// Grup cozumlemeyen istemci — geriye donuk uyumluluk kontrolu icin
class PlainTestApiClient extends BaseApiClient {
    getBaseURL(): string { return 'https://api.test.local'; }
    getDefaultHeaders(): Record<string, string> { return { 'Content-Type': 'application/json' }; }
    async handleRateLimitError(): Promise<void> { /* noop */ }
    shouldRetry(): boolean { return false; }
    setHttpClient(client: any): void { (this as any).httpClient = client; }
}

const OK_RESPONSE = jest.fn(async (cfg: any) => ({ data: { ok: true }, status: 200, headers: {}, config: cfg }));

function baseConfig(groups?: Record<string, { points: number; duration: number }>) {
    return {
        // Ortak limiter bilerek DAR (1 istek) — gruplarin bagimsiz calistigi boylece gorunur
        rateLimiter: { points: 1, duration: 60, ...(groups ? { groups } : {}) },
        // interval: 0 -> p-queue interval timer'i olusturmaz (test sonrasi timer sizintisini onler)
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
    } as any;
}

/**
 * Rate limit asildiginda BaseApiClient `sleep()` ile bekler. Testte gercekten beklememek
 * icin sleep spy'lanir; ayni zamanda "limit asildi mi" olcumunun kendisi olur.
 */
function makeGroupedClient(httpRequest: jest.Mock) {
    const groups = {
        read: { points: 2, duration: 60 },
        write: { points: 1, duration: 60 }
    };
    const client = new GroupedTestApiClient(baseConfig(groups), 'test-service', 'Trendyol' as any);
    client.setHttpClient({ request: httpRequest });
    const sleepSpy = jest.spyOn(client as any, 'sleep').mockResolvedValue(undefined);
    return { client, sleepSpy };
}

const REQ = { logRequest: false };

describe('BaseApiClient — servis-grubu rate limiting (#604)', () => {
    beforeEach(() => jest.clearAllMocks());
    afterEach(() => jest.restoreAllMocks());

    it('her grup bagimsiz sayac tutar; bir grubun kotasi digerini etkilemez', async () => {
        const httpRequest = jest.fn(OK_RESPONSE);
        const { client, sleepSpy } = makeGroupedClient(httpRequest);

        // read grubu kotasi 2 → iki istek beklemesiz gecer
        await client.get('/products', { ...REQ, operationType: OperationType.FETCH_PRODUCTS });
        await client.get('/categories/1/attributes', { ...REQ, operationType: OperationType.GET_CATEGORY_ATTRIBUTES });

        // write grubu kotasi 1 → read tuketilmis olsa da write hala serbest
        await client.post('/products', {}, { ...REQ, operationType: OperationType.SEND_PRODUCTS });

        // Ortak limiter (points: 1) kullanilsaydi 2. istekten itibaren beklenirdi
        expect(sleepSpy).not.toHaveBeenCalled();
        expect(httpRequest).toHaveBeenCalledTimes(3);
    });

    it('ayni gruptaki farkli operasyonlar ORTAK kotayi tuketir', async () => {
        const httpRequest = jest.fn(OK_RESPONSE);
        const { client, sleepSpy } = makeGroupedClient(httpRequest);

        // read kotasi 2: iki farkli operasyon turu ayni kotadan yer
        await client.get('/products', { ...REQ, operationType: OperationType.FETCH_PRODUCTS });
        await client.get('/categories/1/attributes', { ...REQ, operationType: OperationType.GET_CATEGORY_ATTRIBUTES });
        expect(sleepSpy).not.toHaveBeenCalled();

        // 3. read istegi kotayi asar → beklemeye girer
        await client.get('/products', { ...REQ, operationType: OperationType.FETCH_PRODUCTS });
        expect(sleepSpy).toHaveBeenCalledTimes(1);
    });

    it('grup kotasi asilsa bile istek gonderilir (bekleme sonrasi devam eder)', async () => {
        const httpRequest = jest.fn(OK_RESPONSE);
        const { client, sleepSpy } = makeGroupedClient(httpRequest);

        await client.post('/products', {}, { ...REQ, operationType: OperationType.SEND_PRODUCTS });
        await client.post('/products', {}, { ...REQ, operationType: OperationType.SEND_PRODUCTS });

        expect(sleepSpy).toHaveBeenCalledTimes(1);
        // Bekleme sonrasi istek DUSURULMEZ — iki cagri da API'ye ulasir
        expect(httpRequest).toHaveBeenCalledTimes(2);
    });

    it('config icinde tanimsiz gruba cozumlenen istek ortak limiter\'a duser', async () => {
        const httpRequest = jest.fn(OK_RESPONSE);
        const { client, sleepSpy } = makeGroupedClient(httpRequest);

        // 'tanimsiz-grup' config'de yok → ortak limiter (points: 1)
        await client.post('/price-and-inventory', {}, { ...REQ, operationType: OperationType.UPDATE_STOCK_AND_PRICE });
        expect(sleepSpy).not.toHaveBeenCalled();

        // Ikinci istek ortak limiter kotasini asar
        await client.post('/price-and-inventory', {}, { ...REQ, operationType: OperationType.UPDATE_STOCK_AND_PRICE });
        expect(sleepSpy).toHaveBeenCalledTimes(1);
    });

    it('grup cozumlemeyen operasyonlar ortak limiter\'i kullanir', async () => {
        const httpRequest = jest.fn(OK_RESPONSE);
        const { client, sleepSpy } = makeGroupedClient(httpRequest);

        // FETCH_ORDERS icin resolveRateLimitGroup undefined doner → ortak limiter (points: 1)
        await client.get('/orders', { ...REQ, operationType: OperationType.FETCH_ORDERS });
        expect(sleepSpy).not.toHaveBeenCalled();

        await client.get('/orders', { ...REQ, operationType: OperationType.FETCH_ORDERS });
        expect(sleepSpy).toHaveBeenCalledTimes(1);
    });

    it('geriye donuk uyumluluk: groups tanimlanmazsa tum istekler tek ortak limiter\'i tuketir', async () => {
        const httpRequest = jest.fn(OK_RESPONSE);
        const client = new PlainTestApiClient(baseConfig(), 'test-service', 'Trendyol' as any);
        client.setHttpClient({ request: httpRequest });
        const sleepSpy = jest.spyOn(client as any, 'sleep').mockResolvedValue(undefined);

        await client.get('/products', { ...REQ, operationType: OperationType.FETCH_PRODUCTS });
        expect(sleepSpy).not.toHaveBeenCalled();

        // Farkli operasyon turu olsa bile ayni (tek) kotadan tuketir
        await client.post('/products', {}, { ...REQ, operationType: OperationType.SEND_PRODUCTS });
        expect(sleepSpy).toHaveBeenCalledTimes(1);
    });

    it('skipRateLimit ile gonderilen istekler hicbir kotayi tuketmez', async () => {
        const httpRequest = jest.fn(OK_RESPONSE);
        const { client, sleepSpy } = makeGroupedClient(httpRequest);

        for (let i = 0; i < 5; i++) {
            await client.post('/products', {}, { ...REQ, skipRateLimit: true, operationType: OperationType.SEND_PRODUCTS });
        }

        expect(sleepSpy).not.toHaveBeenCalled();
        expect(httpRequest).toHaveBeenCalledTimes(5);
    });
});
