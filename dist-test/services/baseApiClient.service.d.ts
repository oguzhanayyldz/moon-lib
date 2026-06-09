interface AxiosError extends Error {
    response?: {
        status: number;
        statusText?: string;
        data: any;
        headers: any;
    };
    config?: any;
    code?: string;
}
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { IApiClient, RequestConfig } from '../common/interfaces/api-client.interface';
import { BaseApiClientConfig, ApiRequestMetrics } from '../common/types/api-client.types';
import { CircuitBreaker } from './circuitBreaker.service';
import { IntegrationRequestLogService } from './integrationRequestLog.service';
import { ResourceName } from '../common';
import { CircuitBreakerMetrics } from '../common/types/api-client.types';
import { OperationType } from '../enums/operation-type.enum';
export declare abstract class BaseApiClient implements IApiClient {
    protected httpClient: any;
    protected rateLimiter: RateLimiterMemory;
    protected queue: any;
    /**
     * Issue #566: Operasyon-farkindalikli devre kesme. Tek bir CircuitBreaker yerine
     * her operasyon turu (operationType) icin ayri breaker. Bir operasyon ust uste hata
     * verirse SADECE o operasyonun devresi acilir; diger operasyonlar etkilenmez.
     */
    protected circuitBreakers: Map<string, CircuitBreaker>;
    private circuitBreakerConfig;
    private circuitBreakerServiceName;
    protected logService?: IntegrationRequestLogService;
    protected tracer: any;
    protected config: BaseApiClientConfig;
    protected metrics: ApiRequestMetrics;
    protected integrationName: ResourceName;
    constructor(config: BaseApiClientConfig, serviceName: string, integrationName: ResourceName, tracer?: any, logService?: IntegrationRequestLogService);
    abstract getBaseURL(): string;
    abstract getDefaultHeaders(): Record<string, string>;
    abstract handleRateLimitError(error: AxiosError): Promise<void>;
    abstract shouldRetry(error: AxiosError): boolean;
    protected handleCustomError?(error: AxiosError): void;
    get<T>(url: string, config?: RequestConfig): Promise<T>;
    post<T>(url: string, data?: any, config?: RequestConfig): Promise<T>;
    put<T>(url: string, data?: any, config?: RequestConfig): Promise<T>;
    delete<T>(url: string, config?: RequestConfig): Promise<T>;
    graphql<T>(query: string, variables?: any, config?: RequestConfig): Promise<T>;
    protected processGraphQLResponse<T>(response: any, query?: string): T;
    protected applyResponseProcessing(response: any, context?: {
        isGraphQL?: boolean;
        query?: string;
        url?: string;
    }): any;
    protected getGraphQLEndpoint?(): string;
    protected makeRequest<T>(requestConfig: RequestConfig): Promise<T>;
    private executeRequest;
    private checkRateLimit;
    private calculateRetryDelay;
    private logRequest;
    private logResponse;
    private buildFullUrl;
    private updateMetrics;
    private sleep;
    private setupHttpClient;
    reconfigureHttpClient(): void;
    private setupRateLimiter;
    private setupQueue;
    private setupCircuitBreaker;
    /**
     * Issue #566: Verilen operasyon turu icin CircuitBreaker'i dondurur, yoksa olusturur (lazy).
     * Her operasyonun kendi devre durumu (CLOSED/OPEN/HALF_OPEN) izole sekilde takip edilir.
     */
    private getCircuitBreaker;
    private setupTracing;
    private setupInterceptors;
    getMetrics(): ApiRequestMetrics;
    /**
     * Issue #566: Devre kesme metrikleri.
     *  - operationType verilirse: o operasyonun breaker metrikleri.
     *  - verilmezse: tum operasyon breaker'larinin AGGREGATE metrikleri (geriye uyumlu).
     *    State, herhangi biri OPEN ise OPEN; degilse herhangi biri HALF_OPEN ise HALF_OPEN; aksi halde CLOSED.
     */
    getCircuitBreakerMetrics(operationType?: OperationType | string): CircuitBreakerMetrics;
    /**
     * Issue #566: Operasyon bazinda devre kesme metrikleri (tum operasyonlar tek tek).
     */
    getCircuitBreakerMetricsByOperation(): Record<string, CircuitBreakerMetrics>;
    /**
     * Issue #566: Devre kesme sifirlama.
     *  - operationType verilirse: yalnizca o operasyonun breaker'i.
     *  - verilmezse: tum operasyon breaker'lari (geriye uyumlu).
     */
    resetCircuitBreaker(operationType?: OperationType | string): void;
    private static defaultClosedMetrics;
}
export {};
//# sourceMappingURL=baseApiClient.service.d.ts.map