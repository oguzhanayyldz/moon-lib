import { CircuitBreakerState, CircuitBreakerConfig, CircuitBreakerMetrics, CircuitBreakerOpenError } from '../common/types/api-client.types';
import { logger } from './logger.service';

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private halfOpenCallCount: number = 0;
  
  constructor(
    private readonly config: CircuitBreakerConfig,
    private readonly serviceName: string
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check circuit state before execution
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        this.logEvent('Circuit breaker is open, request rejected');
        throw new CircuitBreakerOpenError(this.serviceName);
      }
    }

    // In half-open state, limit the number of calls
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      const maxCalls = this.config.halfOpenMaxCalls || 3;
      if (this.halfOpenCallCount >= maxCalls) {
        this.logEvent('Half-open call limit exceeded, rejecting request');
        throw new CircuitBreakerOpenError(this.serviceName);
      }
      this.halfOpenCallCount++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    
    const timeSinceLastFailure = Date.now() - this.lastFailureTime;
    return timeSinceLastFailure >= this.config.resetTimeout;
  }

  private transitionToHalfOpen(): void {
    this.state = CircuitBreakerState.HALF_OPEN;
    this.halfOpenCallCount = 0;
    this.logEvent('Circuit breaker transitioned to HALF_OPEN');
  }

  private onSuccess(): void {
    this.lastSuccessTime = Date.now();
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Successful call in half-open state closes the circuit
      this.state = CircuitBreakerState.CLOSED;
      this.failureCount = 0;
      this.halfOpenCallCount = 0;
      this.logEvent('Circuit breaker closed after successful call');
    }
    
    this.successCount++;
  }

  private onFailure(error: any): void {
    this.lastFailureTime = Date.now();
    
    // Only count failures for expected error types
    if (this.isExpectedError(error)) {
      this.failureCount++;
      
      if (this.state === CircuitBreakerState.HALF_OPEN) {
        // Failure in half-open state opens the circuit immediately
        this.state = CircuitBreakerState.OPEN;
        this.halfOpenCallCount = 0;
        this.logEvent('Circuit breaker opened due to failure in half-open state');
      } else if (this.state === CircuitBreakerState.CLOSED && 
                 this.failureCount >= this.config.failureThreshold) {
        // Too many failures in closed state opens the circuit
        this.state = CircuitBreakerState.OPEN;
        this.logEvent(`Circuit breaker opened due to ${this.failureCount} failures`);
      }
    }
  }

  private isExpectedError(error: any): boolean {
    if (!error) return false;
    
    // Check for network errors
    if (error.code && this.config.expectedErrors.includes(error.code)) {
      return true;
    }
    
    // Check for HTTP status codes
    if (error.response?.status) {
      const status = error.response.status.toString();
      return this.config.expectedErrors.includes(status) || 
             (error.response.status >= 500 && error.response.status < 600);
    }
    
    return false;
  }

  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failures: this.failureCount,
      successes: this.successCount,
      timeouts: 0, // Will be implemented with request timeout tracking
      fallbackCalls: 0, // Will be implemented with fallback mechanism
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime
    };
  }

  getCurrentState(): CircuitBreakerState {
    return this.state;
  }

  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenCallCount = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.logEvent('Circuit breaker manually reset');
  }

  private logEvent(message: string): void {
    logger.info(`[CircuitBreaker:${this.serviceName}] ${message}`, {
      state: this.state,
      failures: this.failureCount,
      successes: this.successCount,
      halfOpenCalls: this.halfOpenCallCount
    });
  }
}