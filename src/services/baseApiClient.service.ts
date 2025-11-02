import axios from 'axios';
import http from 'http';
import https from 'https';
// Type definitions for axios compatibility
interface AxiosInstance {
  request<T = any>(config: any): Promise<AxiosResponse<T>>;
  defaults: any;
  interceptors: {
    request: { use: (success: (config: any) => any, error: (error: any) => any) => void };
    response: { use: (success: (response: any) => any, error: (error: any) => any) => void };
  };
}
interface AxiosError extends Error {
  response?: { status: number; statusText?: string; data: any; headers: any };
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
interface AxiosResponse<T = any> {
  data: T;
  status: number;
  headers: any;
  config: any;
}
type InternalAxiosRequestConfig = AxiosRequestConfig & {
  headers?: Record<string, any>;
};
import { RateLimiterMemory } from 'rate-limiter-flexible';
const PQueue = require('p-queue').default;

import { IApiClient, RequestConfig } from '../common/interfaces/api-client.interface';
import { 
  BaseApiClientConfig, 
  ApiRateLimitConfig, 
  QueueConfig, 
  CircuitBreakerConfig,
  ApiRetryConfig,
  ApiRequestMetrics,
  RateLimitExceededError,
  ResponseProcessingConfig 
} from '../common/types/api-client.types';

import { CircuitBreaker } from './circuitBreaker.service';
import { IntegrationRequestLogService } from './integrationRequestLog.service';
import { logger } from './logger.service';
import { ResourceName } from '../common';

export abstract class BaseApiClient implements IApiClient {
  protected httpClient!: any;
  protected rateLimiter!: RateLimiterMemory;
  protected queue!: any;
  protected circuitBreaker!: CircuitBreaker;
  protected logService?: IntegrationRequestLogService;
  protected tracer: any;
  protected config: BaseApiClientConfig;
  protected metrics: ApiRequestMetrics;
  protected integrationName: ResourceName;

  constructor(
    config: BaseApiClientConfig, 
    serviceName: string, 
    integrationName: ResourceName,
    tracer?: any,
    logService?: IntegrationRequestLogService
  ) {
    this.config = config;
    this.integrationName = integrationName;
    this.logService = logService;
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    };

    // Setup dependencies first (HTTP client will be set up later by child classes)
    this.setupRateLimiter(config.rateLimiter);
    this.setupQueue(config.queue);
    this.setupCircuitBreaker(config.circuitBreaker, serviceName);
    this.setupTracing(tracer);
    
    // Note: HTTP client setup is deferred to child classes via reconfigureHttpClient()
  }

  // Abstract methods that must be implemented by concrete classes
  abstract getBaseURL(): string;
  abstract getDefaultHeaders(): Record<string, string>;
  abstract handleRateLimitError(error: AxiosError): Promise<void>;
  abstract shouldRetry(error: AxiosError): boolean;

  // Optional abstract method for custom error handling
  protected handleCustomError?(error: AxiosError): void;

  // Public API methods
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.makeRequest<T>({ ...config, method: 'GET', url });
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.makeRequest<T>({ ...config, method: 'POST', url, data });
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.makeRequest<T>({ ...config, method: 'PUT', url, data });
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.makeRequest<T>({ ...config, method: 'DELETE', url });
  }

  // GraphQL support method - can be overridden by child classes
  async graphql<T>(query: string, variables?: any, config?: AxiosRequestConfig): Promise<T> {
    // Use custom GraphQL endpoint if implemented by child class
    const graphqlEndpoint = this.getGraphQLEndpoint ? this.getGraphQLEndpoint() : '/graphql';
    
    const response = await this.makeRequest<any>({
      ...config,
      method: 'POST',
      url: graphqlEndpoint,
      data: { query, variables }
    });

    // Handle GraphQL-specific response structure and errors
    return this.processGraphQLResponse<T>(response, query);
  }

  // Process GraphQL response - handles both standard HTTP response and GraphQL-specific structure
  protected processGraphQLResponse<T>(response: any, query?: string): T {
    // Null/undefined response check - enhanced safety
    if (response === null || response === undefined) {
      const errorMsg = 'GraphQL API returned null or undefined response';
      logger.error(errorMsg, {
        query: query?.substring(0, 100) + '...',
        integrationName: this.integrationName,
        receivedResponse: response
      });
      throw new Error(errorMsg);
    }

    // Apply response processing pipeline if configured
    const processedResponse = this.applyResponseProcessing(response, { isGraphQL: true, query });

    // Null/undefined after processing check
    if (processedResponse === null || processedResponse === undefined) {
      const errorMsg = 'GraphQL response became null/undefined after processing';
      logger.error(errorMsg, {
        query: query?.substring(0, 100) + '...',
        integrationName: this.integrationName,
        originalResponse: response,
        processedResponse
      });
      throw new Error(errorMsg);
    }

    // Check for GraphQL errors first
    if (processedResponse.errors && Array.isArray(processedResponse.errors)) {
      const errorMessage = processedResponse.errors.map((err: any) => err.message || err).join(', ');
      logger.error('GraphQL Response Errors', {
        errors: processedResponse.errors,
        query: query?.substring(0, 100) + '...',
        integrationName: this.integrationName
      });
      throw new Error(`GraphQL errors: ${errorMessage}`);
    }

    // Handle different GraphQL response structures
    if (typeof processedResponse === 'object') {
      // Standard GraphQL response structure: { data: {...}, errors?: [...] }
      if (processedResponse.data !== undefined) {
        return processedResponse.data as T;
      }

      // Direct response (some GraphQL APIs might return data directly)
      return processedResponse as T;
    }

    // Invalid response type
    const errorMsg = `GraphQL response is not an object: ${typeof processedResponse}`;
    logger.error(errorMsg, {
      query: query?.substring(0, 100) + '...',
      integrationName: this.integrationName,
      responseType: typeof processedResponse,
      response: processedResponse
    });
    throw new Error(errorMsg);
  }

  // Apply response processing pipeline
  protected applyResponseProcessing(response: any, context: { isGraphQL?: boolean; query?: string; url?: string } = {}): any {
    const processingConfig = this.config.responseProcessing;
    
    // If no processing config, return as-is
    if (!processingConfig) {
      return response;
    }

    let processedResponse = response;

    // Apply custom processors if configured
    if (processingConfig.customProcessors) {
      for (const processor of processingConfig.customProcessors) {
        if (processor.condition(processedResponse, context)) {
          logger.debug(`Applying response processor: ${processor.name}`, {
            integrationName: this.integrationName,
            context
          });
          processedResponse = processor.process(processedResponse, context);
        }
      }
    }

    // Auto-extract data if enabled (for nested API responses)
    // Enhanced with null/undefined safety checks to prevent errors when API times out
    if (processingConfig.autoExtractData && processedResponse !== null && processedResponse !== undefined && typeof processedResponse === 'object') {
      // Check for common nested structures
      // Use optional chaining to prevent "Cannot read properties of undefined" errors
      if (processedResponse.data !== undefined && !context.isGraphQL) {
        logger.debug('Auto-extracting data from nested response', {
          integrationName: this.integrationName,
          hasData: !!processedResponse.data
        });
        processedResponse = processedResponse.data;
      }
    }

    return processedResponse;
  }

  // Optional method for child classes to override GraphQL endpoint
  protected getGraphQLEndpoint?(): string;

  // Core request method
  protected async makeRequest<T>(requestConfig: RequestConfig): Promise<T> {
    const startTime = Date.now();
    let logId: string | undefined;

    // Merge default headers with request headers
    const finalConfig: RequestConfig = {
      ...requestConfig,
      headers: {
        ...this.getDefaultHeaders(),
        ...requestConfig.headers
      }
    };

    // Enhanced request logging
    logger.debug('Making API request', {
      method: finalConfig.method?.toUpperCase(),
      url: finalConfig.url,
      hasRateLimit: !finalConfig.skipRateLimit,
      hasCircuitBreaker: !finalConfig.skipCircuitBreaker,
      hasLogRequest: finalConfig.logRequest !== false,
      integrationName: this.integrationName
    });

    try {
      // Rate limiting check (unless skipped)
      if (!finalConfig.skipRateLimit) {
        await this.checkRateLimit(finalConfig);
      }

      // Add request to queue and execute with circuit breaker
      const response = await this.queue.add(async () => {
        if (!finalConfig.skipCircuitBreaker) {
          return this.circuitBreaker.execute(() => this.executeRequest<T>(finalConfig));
        } else {
          return this.executeRequest<T>(finalConfig);
        }
      }) as AxiosResponse<T>;

      // Log successful request
      if (finalConfig.logRequest !== false && this.logService) {
        const duration = Date.now() - startTime;
        try {
          logId = await this.logRequest(finalConfig);
          await this.logResponse(logId, {
            responseStatus: response?.status || 0,
            responseHeaders: response?.headers,
            responseBody: response?.data,
            duration
          });
        } catch (logError: any) {
          logger.warn('Failed to log successful request', {
            error: logError.message,
            integrationName: this.integrationName
          });
        }
      }

      // Update metrics
      this.updateMetrics(true, Date.now() - startTime);

      logger.debug('API request completed successfully', {
        method: finalConfig.method,
        url: finalConfig.url,
        status: response?.status,
        duration: Date.now() - startTime,
        integrationName: this.integrationName
      });

      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log failed request
      if (requestConfig.logRequest !== false && this.logService) {
        try {
          if (!logId) {
            logId = await this.logRequest(requestConfig);
          }

          // Enhanced error parsing - child classes (like ShopifyApiClient) may return structured error objects
          let responseStatus = (error as AxiosError).response?.status || 500; // Default to 500 instead of 0
          let responseBody: any = (error as AxiosError).response?.data || (error as Error).message;

          // Try to parse enhanced error objects (JSON-stringified errors from child classes)
          if ((error as Error).message && !((error as AxiosError).response)) {
            try {
              const parsedError = JSON.parse((error as Error).message);

              // Check if this is an enhanced error object with statusCode and message
              if (parsedError && typeof parsedError === 'object' && parsedError.statusCode && parsedError.message) {
                responseStatus = parsedError.statusCode;

                // Build user-friendly error message
                const errorType = parsedError.type ? `[${parsedError.type}] ` : '';
                const errorMessage = parsedError.message;
                const errorDetails = parsedError.details ? ` - ${JSON.stringify(parsedError.details)}` : '';

                responseBody = `${errorType}${errorMessage}${errorDetails}`;

                logger.debug('Enhanced error parsed successfully', {
                  originalStatus: 0,
                  parsedStatus: responseStatus,
                  errorType: parsedError.type,
                  integrationName: this.integrationName
                });
              }
            } catch (parseError) {
              // Not a JSON error or parsing failed - keep original values
              logger.debug('Error message is not enhanced JSON format, using original', {
                integrationName: this.integrationName
              });
            }
          }

          await this.logResponse(logId, {
            responseStatus,
            responseHeaders: (error as AxiosError).response?.headers,
            responseBody,
            duration
          });
        } catch (logError: any) {
          logger.warn('Failed to log failed request', {
            error: logError.message,
            integrationName: this.integrationName
          });
        }
      }

      // Update metrics
      this.updateMetrics(false, duration);

      // Handle custom error processing
      if (this.handleCustomError) {
        try {
          this.handleCustomError(error as AxiosError);
        } catch (customErrorHandlingError: any) {
          logger.warn('Custom error handler failed', {
            error: customErrorHandlingError.message,
            integrationName: this.integrationName
          });
        }
      }

      logger.error('API request failed', {
        method: requestConfig.method,
        url: requestConfig.url,
        status: (error as AxiosError).response?.status,
        errorMessage: (error as Error).message,
        duration,
        integrationName: this.integrationName
      });

      throw error;
    }
  }

  private async executeRequest<T>(requestConfig: RequestConfig): Promise<AxiosResponse<T>> {
    let lastError: AxiosError;
    const retryConfig = this.config.retries;
    let retryCount = 0;

    while (retryCount <= (retryConfig?.maxRetries || 0)) {
      try {
        const span = this.tracer?.startSpan(`api-request-${requestConfig.method?.toLowerCase()}`);

        if (span) {
          span.setTag('http.method', requestConfig.method);
          span.setTag('http.url', requestConfig.url);
        }

        const response = await this.httpClient.request(requestConfig);

        if (span) {
          if (response?.status) {
            span.setTag('http.status_code', response.status);
          }
          span.finish();
        }

        return response;
      } catch (error) {
        lastError = error as AxiosError;

        // Enhanced error logging with defensive checks
        logger.error('Request execution error', {
          hasResponse: !!lastError.response,
          status: lastError.response?.status,
          statusText: lastError.response?.statusText,
          code: lastError.code,
          message: lastError.message,
          method: requestConfig.method,
          url: requestConfig.url,
          integrationName: this.integrationName,
          retryCount,
          maxRetries: retryConfig?.maxRetries || 0
        });

        // Handle rate limit errors specifically
        if (lastError.response?.status === 429) {
          logger.warn('Rate limit detected (429), calling handleRateLimitError', {
            integrationName: this.integrationName,
            retryCount,
            maxRetries: retryConfig?.maxRetries
          });

          try {
            await this.handleRateLimitError(lastError);
          } catch (rateLimitError: any) {
            logger.error('handleRateLimitError failed', {
              error: rateLimitError.message,
              integrationName: this.integrationName
            });
          }
        }

        // Check if this error should be retried
        if (retryCount < (retryConfig?.maxRetries || 0) && this.shouldRetry(lastError)) {
          retryCount++;
          const delay = this.calculateRetryDelay(retryCount, retryConfig);

          logger.info(`Retrying request (attempt ${retryCount}/${retryConfig?.maxRetries}) after ${delay}ms`, {
            method: requestConfig.method,
            url: requestConfig.url,
            error: lastError.message,
            integrationName: this.integrationName
          });

          await this.sleep(delay);
          continue;
        }

        throw lastError;
      }
    }

    throw lastError!;
  }

  private async checkRateLimit(requestConfig: RequestConfig): Promise<void> {
    try {
      const userId = this.config.userId || 'default';
      await this.rateLimiter.consume(userId, 1);
    } catch (rateLimiterResponse: any) {
      const msBeforeNext = rateLimiterResponse.msBeforeNext || 5000;
      
      logger.warn('Rate limit exceeded, waiting before retry', {
        userId: this.config.userId,
        waitTime: msBeforeNext,
        url: requestConfig.url
      });

      await this.sleep(msBeforeNext);
      throw new RateLimitExceededError(msBeforeNext);
    }
  }

  private calculateRetryDelay(retryCount: number, retryConfig?: ApiRetryConfig): number {
    if (!retryConfig) return 1000;

    const exponentialDelay = retryConfig.initialDelay * Math.pow(retryConfig.backoffFactor, retryCount - 1);
    return Math.min(exponentialDelay, retryConfig.maxDelay);
  }

  private async logRequest(requestConfig: RequestConfig): Promise<string> {
    if (!this.logService) return '';

    return this.logService.logRequest({
      method: requestConfig.method?.toUpperCase() || 'GET',
      endpoint: this.buildFullUrl(requestConfig.url || ''),
      requestHeaders: { ...this.getDefaultHeaders(), ...requestConfig.headers },
      requestBody: requestConfig.data,
      userId: this.config.userId || 'unknown',
      integrationName: this.integrationName
    });
  }

  private async logResponse(logId: string, params: any): Promise<void> {
    if (!this.logService || !logId) return;

    await this.logService.logResponse(logId, params);
  }

  private buildFullUrl(url: string): string {
    if (url.startsWith('http')) return url;
    const baseURL = this.getBaseURL();
    const fullUrl = `${baseURL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
    logger.debug('Building full URL', { 
      baseURL, 
      url, 
      fullUrl,
      integrationName: this.integrationName
    });
    return fullUrl;
  }

  private updateMetrics(success: boolean, responseTime: number): void {
    this.metrics.totalRequests++;
    this.metrics.lastRequestTime = Date.now();

    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // Update average response time
    const totalSuccessTime = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1);
    this.metrics.averageResponseTime = (totalSuccessTime + responseTime) / this.metrics.totalRequests;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Setup methods
  private setupHttpClient(config: BaseApiClientConfig): void {
    this.httpClient = axios.create({
      baseURL: this.getBaseURL(),
      timeout: config.timeout,
      headers: this.getDefaultHeaders()
    });
  }

  // Allow child classes to initialize HTTP client after properties are set
  public reconfigureHttpClient(): void {
    if (!this.httpClient) {
      // Initial setup with HTTP Keep-Alive agents for persistent connections
      const httpAgent = new http.Agent({
        keepAlive: true,
        keepAliveMsecs: 60000, // Keep connection alive for 60 seconds
        maxSockets: 50, // Max concurrent connections
        maxFreeSockets: 10 // Max idle connections to keep open
      });

      const httpsAgent = new https.Agent({
        keepAlive: true,
        keepAliveMsecs: 60000,
        maxSockets: 50,
        maxFreeSockets: 10
      });

      this.httpClient = axios.create({
        baseURL: this.getBaseURL(),
        timeout: this.config.timeout,
        headers: this.getDefaultHeaders(),
        httpAgent: httpAgent,
        httpsAgent: httpsAgent
      });
      this.setupInterceptors();
      
      logger.debug('HTTP client initialized', {
        baseURL: this.httpClient.defaults.baseURL,
        integrationName: this.integrationName
      });
    } else {
      // Reconfiguration
      this.httpClient.defaults.baseURL = this.getBaseURL();
      this.httpClient.defaults.headers.common = {
        ...this.httpClient.defaults.headers.common,
        ...this.getDefaultHeaders()
      };
      
      logger.debug('HTTP client reconfigured', {
        baseURL: this.httpClient.defaults.baseURL,
        integrationName: this.integrationName
      });
    }
  }

  private setupRateLimiter(config: ApiRateLimitConfig): void {
    this.rateLimiter = new RateLimiterMemory({
      points: config.points,
      duration: config.duration,
      blockDuration: config.blockDuration || config.duration
    });
  }

  private setupQueue(config: QueueConfig): void {
    this.queue = new PQueue({
      concurrency: config.concurrency,
      intervalCap: config.intervalCap,
      interval: config.interval,
      timeout: config.timeout,
      carryoverConcurrencyCount: config.carryoverConcurrencyCount
    });
  }

  private setupCircuitBreaker(config: CircuitBreakerConfig, serviceName: string): void {
    this.circuitBreaker = new CircuitBreaker(config, serviceName);
  }

  // setupLogging method artık gerekli değil - constructor'da inject ediliyor

  private setupTracing(tracer?: any): void {
    try {
      this.tracer = tracer;
    } catch (error: any) {
      logger.warn('Failed to initialize tracing', { error: error.message });
    }
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.httpClient.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        logger.debug('HTTP Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL,
          fullURL: config.baseURL ? `${config.baseURL}${config.url}` : config.url,
          headers: {
            'Content-Type': config.headers?.['Content-Type'],
            'X-Shopify-Access-Token': config.headers?.['X-Shopify-Access-Token'] ? '[REDACTED]' : undefined
          }
        });
        return config;
      },
      (error: any) => {
        logger.error('HTTP Request Error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.httpClient.interceptors.response.use(
      (response: AxiosResponse) => {
        logger.debug('HTTP Response', {
          status: response.status,
          url: response.config.url,
          dataExists: !!response.data
        });
        return response;
      },
      (error: AxiosError) => {
        logger.error('HTTP Response Error', {
          status: error.response?.status,
          url: error.config?.url,
          error: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  // Public utility methods
  getMetrics(): ApiRequestMetrics {
    return { ...this.metrics };
  }

  getCircuitBreakerMetrics() {
    return this.circuitBreaker.getMetrics();
  }

  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }
}