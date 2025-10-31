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
interface AxiosRequestConfig {
    method?: string;
    url?: string;
    headers?: Record<string, any>;
    data?: any;
    timeout?: number;
    baseURL?: string;
    params?: any;
}
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { IApiClient, RequestConfig } from '../common/interfaces/api-client.interface';
import { BaseApiClientConfig, ApiRequestMetrics } from '../common/types/api-client.types';
import { CircuitBreaker } from './circuitBreaker.service';
import { IntegrationRequestLogService } from './integrationRequestLog.service';
import { ResourceName } from '../common';
export declare abstract class BaseApiClient implements IApiClient {
    protected httpClient: any;
    protected rateLimiter: RateLimiterMemory;
    protected queue: any;
    protected circuitBreaker: CircuitBreaker;
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
    get<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
    post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
    put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
    delete<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
    graphql<T>(query: string, variables?: any, config?: AxiosRequestConfig): Promise<T>;
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
    private setupTracing;
    private setupInterceptors;
    getMetrics(): ApiRequestMetrics;
    getCircuitBreakerMetrics(): import("../common").CircuitBreakerMetrics;
    resetCircuitBreaker(): void;
}
export {};
//# sourceMappingURL=baseApiClient.service.d.ts.map