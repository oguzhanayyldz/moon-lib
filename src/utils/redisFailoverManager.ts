import { redisWrapper } from '../services/redisWrapper.service';
import { logger } from '../services/logger.service';

/**
 * Redis connection health status
 */
interface RedisHealthStatus {
  isHealthy: boolean;
  lastCheckTime: Date;
  consecutiveFailures: number;
  circuitBreakerOpen: boolean;
}

/**
 * Redis failover configuration
 */
interface RedisFailoverConfig {
  maxRetries: number;
  retryDelayMs: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetTimeMs: number;
  healthCheckIntervalMs: number;
  enableFallback: boolean;
}

/**
 * RedisFailoverManager
 * Provides Redis connection resilience with circuit breaker pattern
 * Handles connection failures gracefully with fallback mechanisms
 */
export class RedisFailoverManager {
  private static readonly DEFAULT_CONFIG: RedisFailoverConfig = {
    maxRetries: 3,
    retryDelayMs: 1000,
    circuitBreakerThreshold: 5,
    circuitBreakerResetTimeMs: 30000, // 30 seconds
    healthCheckIntervalMs: 10000, // 10 seconds
    enableFallback: true
  };

  private static healthStatus: RedisHealthStatus = {
    isHealthy: true,
    lastCheckTime: new Date(),
    consecutiveFailures: 0,
    circuitBreakerOpen: false
  };

  private static healthCheckInterval: NodeJS.Timeout | null = null;

  /**
   * Execute Redis operation with failover handling
   */
  static async withRedisFailover<T>(
    operation: () => Promise<T>,
    fallback: (() => Promise<T>) | null = null,
    config: Partial<RedisFailoverConfig> = {}
  ): Promise<T> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };

    // Check circuit breaker
    if (this.healthStatus.circuitBreakerOpen) {
      if (this.shouldResetCircuitBreaker(finalConfig.circuitBreakerResetTimeMs)) {
        this.resetCircuitBreaker();
      } else {
        logger.warn('Redis circuit breaker is open, using fallback immediately');
        return this.executeFallback(fallback);
      }
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= finalConfig.maxRetries; attempt++) {
      try {
        const result = await operation();

        // Operation succeeded, reset failure counter
        if (this.healthStatus.consecutiveFailures > 0) {
          this.recordSuccess();
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        this.recordFailure();

        logger.warn(`Redis operation failed (attempt ${attempt}/${finalConfig.maxRetries}):`, error);

        // Check if circuit breaker should be opened
        if (this.healthStatus.consecutiveFailures >= finalConfig.circuitBreakerThreshold) {
          this.openCircuitBreaker();
          logger.error('Redis circuit breaker opened due to consecutive failures');
          break;
        }

        // Wait before retry (except on last attempt)
        if (attempt < finalConfig.maxRetries) {
          await this.sleep(finalConfig.retryDelayMs * attempt); // Exponential backoff
        }
      }
    }

    // All retries failed, use fallback
    logger.error(`Redis operation failed after ${finalConfig.maxRetries} attempts, using fallback`);
    return this.executeFallback(fallback, lastError);
  }

  /**
   * Execute fallback operation
   */
  private static async executeFallback<T>(
    fallback: (() => Promise<T>) | null,
    originalError?: Error | null
  ): Promise<T> {
    if (fallback) {
      try {
        const result = await fallback();
        logger.info('Fallback operation executed successfully');
        return result;
      } catch (fallbackError) {
        logger.error('Fallback operation also failed:', fallbackError);
        throw fallbackError;
      }
    } else {
      const error = originalError || new Error('Redis operation failed and no fallback provided');
      logger.error('No fallback available for failed Redis operation');
      throw error;
    }
  }

  /**
   * Record successful operation
   */
  private static recordSuccess(): void {
    this.healthStatus.consecutiveFailures = 0;
    this.healthStatus.isHealthy = true;
    this.healthStatus.lastCheckTime = new Date();
  }

  /**
   * Record failed operation
   */
  private static recordFailure(): void {
    this.healthStatus.consecutiveFailures++;
    this.healthStatus.isHealthy = false;
    this.healthStatus.lastCheckTime = new Date();
  }

  /**
   * Open circuit breaker
   */
  private static openCircuitBreaker(): void {
    this.healthStatus.circuitBreakerOpen = true;
    this.healthStatus.lastCheckTime = new Date();
    logger.error('Redis circuit breaker opened');
  }

  /**
   * Reset circuit breaker
   */
  private static resetCircuitBreaker(): void {
    this.healthStatus.circuitBreakerOpen = false;
    this.healthStatus.consecutiveFailures = 0;
    this.healthStatus.isHealthy = true;
    this.healthStatus.lastCheckTime = new Date();
    logger.info('Redis circuit breaker reset');
  }

  /**
   * Check if circuit breaker should be reset
   */
  private static shouldResetCircuitBreaker(resetTimeMs: number): boolean {
    const timeSinceOpen = Date.now() - this.healthStatus.lastCheckTime.getTime();
    return timeSinceOpen >= resetTimeMs;
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Start health check monitoring
   */
  static startHealthCheck(config: Partial<RedisFailoverConfig> = {}): void {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };

    if (this.healthCheckInterval) {
      this.stopHealthCheck();
    }

    logger.info('Starting Redis health check monitoring');

    this.healthCheckInterval = setInterval(async () => {
      try {
        // Simple ping to check Redis health
        await redisWrapper.client.ping();

        if (!this.healthStatus.isHealthy) {
          logger.info('Redis health check passed, marking as healthy');
          this.recordSuccess();
        }
      } catch (error) {
        logger.warn('Redis health check failed:', error);
        this.recordFailure();

        if (this.healthStatus.consecutiveFailures >= finalConfig.circuitBreakerThreshold) {
          this.openCircuitBreaker();
        }
      }
    }, finalConfig.healthCheckIntervalMs);
  }

  /**
   * Stop health check monitoring
   */
  static stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Redis health check monitoring stopped');
    }
  }

  /**
   * Get current Redis health status
   */
  static getHealthStatus(): RedisHealthStatus & {
    uptimePercent: number;
    lastFailureTime?: Date;
  } {
    // Simple uptime calculation based on current health
    const uptimePercent = this.healthStatus.isHealthy ? 100 :
      Math.max(0, 100 - (this.healthStatus.consecutiveFailures * 10));

    return {
      ...this.healthStatus,
      uptimePercent,
      lastFailureTime: this.healthStatus.consecutiveFailures > 0 ?
        this.healthStatus.lastCheckTime : undefined
    };
  }

  /**
   * Force reset circuit breaker (for manual recovery)
   */
  static forceResetCircuitBreaker(): void {
    this.resetCircuitBreaker();
    logger.info('Circuit breaker manually reset');
  }

  /**
   * Test Redis connection
   */
  static async testConnection(): Promise<{
    isConnected: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      await redisWrapper.client.ping();

      return {
        isConnected: true,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        isConnected: false,
        responseTime: Date.now() - startTime,
        error: (error as Error).message
      };
    }
  }
}
