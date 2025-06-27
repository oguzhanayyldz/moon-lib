interface AxiosRequestConfig {
    method?: string;
    url?: string;
    data?: any;
    headers?: Record<string, any>;
    timeout?: number;
    params?: any;
    baseURL?: string;
    [key: string]: any;
}
interface AxiosResponse<T = any> {
    data: T;
    status: number;
    statusText: string;
    headers: any;
    config: AxiosRequestConfig;
}
interface AxiosError extends Error {
    config?: AxiosRequestConfig;
    code?: string;
    request?: any;
    response?: AxiosResponse;
    isAxiosError: boolean;
    toJSON(): object;
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
