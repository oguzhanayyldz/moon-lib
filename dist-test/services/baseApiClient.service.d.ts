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
    /**
     * Issue #604: Servis-grubu farkindalikli rate limiting. Grup tanimlanmis entegrasyonlarda
     * (orn. Trendyol'un 14 Eylul 2026 limitleri) her grup kendi bagimsiz sayacini tutar.
     * Bos ise tum istekler ortak `rateLimiter`'i kullanir — grup tanimlanmamis entegrasyonlarin
     * davranisi degismez.
     */
    protected rateLimiterGroups: Map<string, RateLimiterMemory>;
    protected queue: any;
    /**
     * Default per-call deadline taken from `queue.timeout` (a longer per-call `timeout`
     * extends it, see resolveDeadlineMs). Enforced by BaseApiClient itself
     * (not by p-queue): p-queue's timeout resolves with `undefined` and leaves the task
     * running, so the HTTP request and its retries kept going after the caller gave up.
     */
    private queueTimeoutMs?;
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
    protected isRateLimitedAuthError?(error: AxiosError): boolean;
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
    /**
     * Deadline for one call: `queue.timeout`, extended to the call's own `timeout` when that
     * is longer (e.g. 60 s product uploads on a client whose queue timeout is 30 s). Without
     * the extension those uploads would be cut at the queue timeout and could never finish.
     *
     * No extra margin is added on purpose. The deadline timer starts before the HTTP request
     * is sent, so it always fires before axios' own `timeout` of the same length: the caller
     * gets ApiRequestTimeoutError, the socket is cut and no retry is sent. A margin would let
     * axios time out first and the retry loop would send the same (possibly non-idempotent)
     * upload again. Consequence: axios' per-attempt timeout never fires while a deadline is
     * set; to retry slow attempts, set the request timeout below the queue timeout.
     */
    private resolveDeadlineMs;
    /**
     * Runs `work` under the call deadline. When the deadline passes, the request is
     * aborted (in-flight HTTP call cancelled, retry loop stopped) and the caller gets an
     * ApiRequestTimeoutError instead of p-queue's silent `undefined`.
     */
    private runWithDeadline;
    private executeRequest;
    /**
     * Issue #604: Bir istegin hangi servis-grubu limitine dahil oldugunu belirler.
     *
     * Varsayilan davranis: grup yok — tum istekler ortak limiter'i kullanir.
     * Servis-grubu limiti uygulayan entegrasyonlar (orn. Trendyol) bu metodu override edip
     * operationType'i `rateLimiter.groups` icindeki bir grup adina esler.
     *
     * @param operationType Istegin operasyon turu
     * @returns Grup adi; undefined donerse ortak limiter kullanilir
     */
    protected resolveRateLimitGroup(_operationType: OperationType | string): string | undefined;
    /**
     * Istegin tabi oldugu limiter'i dondurur (issue #604).
     * Cozumlenen grup tanimli degilse ortak limiter'a duser.
     */
    private getRateLimiter;
    private checkRateLimit;
    private calculateRetryDelay;
    private logRequest;
    private logResponse;
    private buildFullUrl;
    private updateMetrics;
    /** Resolves after `ms`, or immediately when `signal` is aborted. */
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