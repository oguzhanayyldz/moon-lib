import { OperationType } from '../../enums/operation-type.enum';
interface AxiosRequestConfig {
    method?: string;
    url?: string;
    headers?: Record<string, any>;
    data?: any;
    timeout?: number;
    baseURL?: string;
    params?: any;
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
    endpoint: string;
    requestHeaders?: Record<string, any>;
    requestBody?: any;
    userId?: string;
    integrationName?: string;
    operationType?: OperationType;
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
    /**
     * Send the request at most once: the client-level retry loop is skipped.
     * Use for non-idempotent calls (e.g. approve/reject) where a duplicate would be harmful.
     * Note: a deadline abort (ApiRequestTimeoutError) does not undo anything on the server.
     * For such calls a timeout means "outcome unknown", not "failed": reconcile before resending.
     */
    skipRetry?: boolean;
    logRequest?: boolean;
    operationType?: OperationType;
    method?: string;
    url?: string;
    headers?: Record<string, any>;
    data?: any;
    params?: any;
}
export {};
//# sourceMappingURL=api-client.interface.d.ts.map