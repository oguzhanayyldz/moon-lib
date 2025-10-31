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
export declare class RedisFailoverManager {
    private static readonly DEFAULT_CONFIG;
    private static healthStatus;
    private static healthCheckInterval;
    /**
     * Execute Redis operation with failover handling
     */
    static withRedisFailover<T>(operation: () => Promise<T>, fallback?: (() => Promise<T>) | null, config?: Partial<RedisFailoverConfig>): Promise<T>;
    /**
     * Execute fallback operation
     */
    private static executeFallback;
    /**
     * Record successful operation
     */
    private static recordSuccess;
    /**
     * Record failed operation
     */
    private static recordFailure;
    /**
     * Open circuit breaker
     */
    private static openCircuitBreaker;
    /**
     * Reset circuit breaker
     */
    private static resetCircuitBreaker;
    /**
     * Check if circuit breaker should be reset
     */
    private static shouldResetCircuitBreaker;
    /**
     * Sleep for specified milliseconds
     */
    private static sleep;
    /**
     * Start health check monitoring
     */
    static startHealthCheck(config?: Partial<RedisFailoverConfig>): void;
    /**
     * Stop health check monitoring
     */
    static stopHealthCheck(): void;
    /**
     * Get current Redis health status
     */
    static getHealthStatus(): RedisHealthStatus & {
        uptimePercent: number;
        lastFailureTime?: Date;
    };
    /**
     * Force reset circuit breaker (for manual recovery)
     */
    static forceResetCircuitBreaker(): void;
    /**
     * Test Redis connection
     */
    static testConnection(): Promise<{
        isConnected: boolean;
        responseTime: number;
        error?: string;
    }>;
}
export {};
