import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
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
  RateLimitExceededError 
} from '../common/types/api-client.types';

import { CircuitBreaker } from './circuitBreaker.service';
import { IntegrationRequestLogService } from './integrationRequestLog.service';
import { logger } from './logger.service';
import { ResourceName } from '../common';

export abstract class BaseApiClient implements IApiClient {
  protected httpClient!: AxiosInstance;
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

    this.setupHttpClient(config);
    this.setupRateLimiter(config.rateLimiter);
    this.setupQueue(config.queue);
    this.setupCircuitBreaker(config.circuitBreaker, serviceName);
    this.setupTracing(tracer);
    this.setupInterceptors();
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

  // GraphQL support method
  async graphql<T>(query: string, variables?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.makeRequest<T>({
      ...config,
      method: 'POST',
      url: '/graphql',
      data: { query, variables }
    });
  }

  // Core request method
  protected async makeRequest<T>(requestConfig: RequestConfig): Promise<T> {
    const startTime = Date.now();
    let logId: string | undefined;

    try {
      // Rate limiting check (unless skipped)
      if (!requestConfig.skipRateLimit) {
        await this.checkRateLimit(requestConfig);
      }

      // Add request to queue and execute with circuit breaker
      const response = await this.queue.add(async () => {
        if (!requestConfig.skipCircuitBreaker) {
          return this.circuitBreaker.execute(() => this.executeRequest<T>(requestConfig));
        } else {
          return this.executeRequest<T>(requestConfig);
        }
      }) as AxiosResponse<T>;

      // Log successful request
      if (requestConfig.logRequest !== false && this.logService) {
        const duration = Date.now() - startTime;
        logId = await this.logRequest(requestConfig);
        await this.logResponse(logId, {
          status: response.status,
          headers: response.headers,
          body: response.data,
          duration
        });
      }

      // Update metrics
      this.updateMetrics(true, Date.now() - startTime);

      return response.data;
    } catch (error) {
      // Log failed request
      if (requestConfig.logRequest !== false && this.logService) {
        const duration = Date.now() - startTime;
        if (!logId) {
          logId = await this.logRequest(requestConfig);
        }
        await this.logResponse(logId, {
          status: (error as AxiosError).response?.status || 0,
          headers: (error as AxiosError).response?.headers,
          body: (error as AxiosError).response?.data || (error as Error).message,
          duration
        });
      }

      // Update metrics
      this.updateMetrics(false, Date.now() - startTime);

      // Handle custom error processing
      if (this.handleCustomError) {
        this.handleCustomError(error as AxiosError);
      }

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

        const response = await this.httpClient.request<T>(requestConfig);
        
        if (span) {
          span.setTag('http.status_code', response.status);
          span.finish();
        }

        return response;
      } catch (error) {
        lastError = error as AxiosError;
        
        // Check if this error should be retried
        if (retryCount < (retryConfig?.maxRetries || 0) && this.shouldRetry(lastError)) {
          retryCount++;
          const delay = this.calculateRetryDelay(retryCount, retryConfig);
          
          logger.info(`Retrying request (attempt ${retryCount}/${retryConfig?.maxRetries}) after ${delay}ms`, {
            method: requestConfig.method,
            url: requestConfig.url,
            error: lastError.message
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
    return `${baseURL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
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
      baseURL: config.baseURL || this.getBaseURL(),
      timeout: config.timeout,
      headers: this.getDefaultHeaders()
    });
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
      (config) => {
        logger.debug('HTTP Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          headers: config.headers
        });
        return config;
      },
      (error) => {
        logger.error('HTTP Request Error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.httpClient.interceptors.response.use(
      (response) => {
        logger.debug('HTTP Response', {
          status: response.status,
          url: response.config.url,
          duration: Date.now() - (response.config as any).startTime
        });
        return response;
      },
      (error) => {
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