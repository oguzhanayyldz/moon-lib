export interface BaseApiClientConfig {
    rateLimiter: ApiRateLimitConfig;
    queue: QueueConfig;
    circuitBreaker: CircuitBreakerConfig;
    timeout: number;
    userId?: string;
    baseURL?: string;
    retries?: ApiRetryConfig;
    responseProcessing?: ResponseProcessingConfig;
    authFailureTracking?: AuthFailureTrackingConfig;
}
/**
 * 401/403 auth hatalarinin ardisik olarak sayilmasi icin config (issue #521, #566).
 * userId + integrationId + operationType kombinasyonuna gore Redis'te counter tutulur.
 */
export interface AuthFailureTrackingConfig {
    userId: string;
    integrationId: string;
    integrationName: string;
    threshold?: number;
    /**
     * Akilli pasiflestirme esigi (issue #566): Entegrasyonu pasife cekmek icin
     * KAC FARKLI operasyon turunun kendi auth esigini asmasi gerektigi.
     * Tek bir bozuk endpoint (orn. FETCH_INVOICES) tum entegrasyonu durdurmasin diye;
     * gercek credential-geneli sorunlarda (>=N farkli operasyon basarisiz) pasife cekilir.
     * Varsayilan: 2
     *
     * NOT: SADECE TEK bir operasyon turu calistiran entegrasyonlarda (orn. yalnizca FETCH_ORDERS
     * yapan bir client) distinct sayisi asla 2'ye ulasmaz; credential tamamen gecersiz olsa bile
     * pasiflestirme tetiklenmez. Bu tip entegrasyonlar icin bu degeri ACIKCA 1 gecin.
     */
    deactivationOperationThreshold?: number;
}
export interface ResponseProcessingConfig {
    enableGraphQLProcessing?: boolean;
    autoExtractData?: boolean;
    preserveRawResponse?: boolean;
    customProcessors?: ResponseProcessor[];
}
export interface ResponseProcessor {
    name: string;
    condition: (response: any, config: any) => boolean;
    process: (response: any, config: any) => any;
}
export interface ApiRateLimitConfig {
    points: number;
    duration: number;
    blockDuration?: number;
}
export interface QueueConfig {
    concurrency: number;
    intervalCap: number;
    interval: number;
    timeout?: number;
    carryoverConcurrencyCount?: boolean;
}
export interface CircuitBreakerConfig {
    failureThreshold: number;
    resetTimeout: number;
    monitoringPeriod: number;
    expectedErrors: string[];
    fallbackEnabled: boolean;
    halfOpenMaxCalls?: number;
}
export interface ApiRetryConfig {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    backoffFactor: number;
    retryableErrors: string[];
}
export declare enum CircuitBreakerState {
    CLOSED = "CLOSED",
    OPEN = "OPEN",
    HALF_OPEN = "HALF_OPEN"
}
export interface CircuitBreakerMetrics {
    state: CircuitBreakerState;
    failures: number;
    successes: number;
    timeouts: number;
    fallbackCalls: number;
    lastFailureTime?: number;
    lastSuccessTime?: number;
}
export interface ApiRequestMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    lastRequestTime?: number;
}
export declare abstract class BaseApiError extends Error {
    originalError?: any | undefined;
    abstract category: string;
    abstract priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    abstract isRetryable: boolean;
    constructor(message: string, originalError?: any | undefined);
}
export declare class CircuitBreakerOpenError extends BaseApiError {
    category: string;
    priority: 'HIGH';
    isRetryable: boolean;
    constructor(serviceName: string);
}
export declare class RateLimitExceededError extends BaseApiError {
    category: string;
    priority: 'MEDIUM';
    isRetryable: boolean;
    constructor(retryAfter?: number);
}
//# sourceMappingURL=api-client.types.d.ts.map