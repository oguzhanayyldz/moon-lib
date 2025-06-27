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
export interface IApiClient {
    get<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
    post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
    put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
    delete<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
}
export interface IRateLimiter {
    consume(key: string, points: number): Promise<void>;
    getPointsRemaining(key: string): Promise<number>;
}
export interface IRequestLogger {
    logRequest(params: LogRequestParams): Promise<string>;
    logResponse(logId: string, params: LogResponseParams): Promise<void>;
}
export interface LogRequestParams {
    method: string;
    url: string;
    headers?: Record<string, any>;
    body?: any;
    userId?: string;
    integrationId?: string;
}
export interface LogResponseParams {
    status: number;
    headers?: Record<string, any>;
    body?: any;
    duration?: number;
}
export interface IErrorCategorizer {
    categorizeError(error: any, context: any): ErrorMetadata;
}
export interface ErrorMetadata {
    category: string;
    priority: string;
    isRetryable: boolean;
    message: string;
}
export interface RequestConfig extends AxiosRequestConfig {
    skipRateLimit?: boolean;
    skipCircuitBreaker?: boolean;
    logRequest?: boolean;
    method?: string;
    url?: string;
    headers?: Record<string, any>;
    data?: any;
}
export {};
