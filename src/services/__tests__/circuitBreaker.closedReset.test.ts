import { CircuitBreaker } from '../circuitBreaker.service';
import { CircuitBreakerConfig, CircuitBreakerState } from '../../common/types/api-client.types';

// Kapalı durumda hata sayacı başarılı çağrıda sıfırlanmalı: ardışık olmayan, binlerce başarı
// arasına serpilmiş az sayıda 5xx devreyi açmamalı (B-16).

const httpError = (status: number) => ({ response: { status }, message: `HTTP ${status}`, isAxiosError: true });

describe('CircuitBreaker — KAPALI durumda başarı hata sayacını sıfırlar', () => {
    const config: CircuitBreakerConfig = {
        failureThreshold: 3,
        resetTimeout: 60_000,
        monitoringPeriod: 60_000,
        expectedErrors: [],
        fallbackEnabled: false,
        halfOpenMaxCalls: 3
    };

    const fail = (b: CircuitBreaker) =>
        expect(b.execute(() => Promise.reject(httpError(503)))).rejects.toMatchObject({ response: { status: 503 } });

    it('başarılar arasına serpilmiş hatalar eşiğe ulaşmaz, devre kapalı kalır', async () => {
        const breaker = new CircuitBreaker(config, 'svc');
        for (let round = 0; round < 5; round++) {
            await fail(breaker);
            await fail(breaker);
            await breaker.execute(() => Promise.resolve('ok'));
        }
        expect(breaker.getCurrentState()).toBe(CircuitBreakerState.CLOSED);
        expect(breaker.getMetrics().failures).toBe(0);
    });

    it('ardışık eşik kadar hata yine devreyi açar', async () => {
        const breaker = new CircuitBreaker(config, 'svc');
        await fail(breaker);
        await fail(breaker);
        await fail(breaker);
        expect(breaker.getCurrentState()).toBe(CircuitBreakerState.OPEN);
    });
});
