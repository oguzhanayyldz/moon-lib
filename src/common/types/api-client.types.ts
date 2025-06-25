export interface BaseApiClientConfig {
  rateLimiter: ApiRateLimitConfig;
  queue: QueueConfig;
  circuitBreaker: CircuitBreakerConfig;
  timeout: number;
  userId?: string;
  baseURL?: string;
  retries?: ApiRetryConfig;
}

export interface ApiRateLimitConfig {
  points: number;        // Number of requests allowed
  duration: number;      // Time window in seconds
  blockDuration?: number; // Block duration in seconds (default: duration)
}

export interface QueueConfig {
  concurrency: number;     // Max concurrent requests
  intervalCap: number;     // Max requests per interval
  interval: number;        // Interval in milliseconds
  timeout?: number;        // Request timeout in milliseconds
  carryoverConcurrencyCount?: boolean;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;     // Number of failures before opening circuit
  resetTimeout: number;         // Time before attempting to close circuit (ms)
  monitoringPeriod: number;     // Time window for monitoring failures (ms)
  expectedErrors: string[];     // Error codes that should trigger circuit breaker
  fallbackEnabled: boolean;     // Whether to enable fallback mechanism
  halfOpenMaxCalls?: number;    // Max calls in half-open state (default: 3)
}

export interface ApiRetryConfig {
  maxRetries: number;          // Maximum number of retry attempts
  initialDelay: number;        // Initial delay in milliseconds
  maxDelay: number;           // Maximum delay in milliseconds
  backoffFactor: number;      // Exponential backoff factor
  retryableErrors: string[];  // HTTP status codes that should be retried
}

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
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

export abstract class BaseApiError extends Error {
  abstract category: string;
  abstract priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  abstract isRetryable: boolean;
  
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class CircuitBreakerOpenError extends BaseApiError {
  category = 'CIRCUIT_BREAKER';
  priority: 'HIGH' = 'HIGH';
  isRetryable = false;
  
  constructor(serviceName: string) {
    super(`Circuit breaker is open for service: ${serviceName}`);
  }
}

export class RateLimitExceededError extends BaseApiError {
  category = 'RATE_LIMIT';
  priority: 'MEDIUM' = 'MEDIUM';
  isRetryable = true;
  
  constructor(retryAfter?: number) {
    super(`Rate limit exceeded${retryAfter ? `, retry after ${retryAfter}ms` : ''}`);
  }
}