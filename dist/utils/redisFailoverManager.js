"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisFailoverManager = void 0;
const redisWrapper_service_1 = require("../services/redisWrapper.service");
const logger_service_1 = require("../services/logger.service");
/**
 * RedisFailoverManager
 * Provides Redis connection resilience with circuit breaker pattern
 * Handles connection failures gracefully with fallback mechanisms
 */
class RedisFailoverManager {
    /**
     * Execute Redis operation with failover handling
     */
    static withRedisFailover(operation_1) {
        return __awaiter(this, arguments, void 0, function* (operation, fallback = null, config = {}) {
            const finalConfig = Object.assign(Object.assign({}, this.DEFAULT_CONFIG), config);
            // Check circuit breaker
            if (this.healthStatus.circuitBreakerOpen) {
                if (this.shouldResetCircuitBreaker(finalConfig.circuitBreakerResetTimeMs)) {
                    this.resetCircuitBreaker();
                }
                else {
                    logger_service_1.logger.warn('Redis circuit breaker is open, using fallback immediately');
                    return this.executeFallback(fallback);
                }
            }
            let lastError = null;
            for (let attempt = 1; attempt <= finalConfig.maxRetries; attempt++) {
                try {
                    const result = yield operation();
                    // Operation succeeded, reset failure counter
                    if (this.healthStatus.consecutiveFailures > 0) {
                        this.recordSuccess();
                    }
                    return result;
                }
                catch (error) {
                    lastError = error;
                    this.recordFailure();
                    logger_service_1.logger.warn(`Redis operation failed (attempt ${attempt}/${finalConfig.maxRetries}):`, error);
                    // Check if circuit breaker should be opened
                    if (this.healthStatus.consecutiveFailures >= finalConfig.circuitBreakerThreshold) {
                        this.openCircuitBreaker();
                        logger_service_1.logger.error('Redis circuit breaker opened due to consecutive failures');
                        break;
                    }
                    // Wait before retry (except on last attempt)
                    if (attempt < finalConfig.maxRetries) {
                        yield this.sleep(finalConfig.retryDelayMs * attempt); // Exponential backoff
                    }
                }
            }
            // All retries failed, use fallback
            logger_service_1.logger.error(`Redis operation failed after ${finalConfig.maxRetries} attempts, using fallback`);
            return this.executeFallback(fallback, lastError);
        });
    }
    /**
     * Execute fallback operation
     */
    static executeFallback(fallback, originalError) {
        return __awaiter(this, void 0, void 0, function* () {
            if (fallback) {
                try {
                    const result = yield fallback();
                    logger_service_1.logger.info('Fallback operation executed successfully');
                    return result;
                }
                catch (fallbackError) {
                    logger_service_1.logger.error('Fallback operation also failed:', fallbackError);
                    throw fallbackError;
                }
            }
            else {
                const error = originalError || new Error('Redis operation failed and no fallback provided');
                logger_service_1.logger.error('No fallback available for failed Redis operation');
                throw error;
            }
        });
    }
    /**
     * Record successful operation
     */
    static recordSuccess() {
        this.healthStatus.consecutiveFailures = 0;
        this.healthStatus.isHealthy = true;
        this.healthStatus.lastCheckTime = new Date();
    }
    /**
     * Record failed operation
     */
    static recordFailure() {
        this.healthStatus.consecutiveFailures++;
        this.healthStatus.isHealthy = false;
        this.healthStatus.lastCheckTime = new Date();
    }
    /**
     * Open circuit breaker
     */
    static openCircuitBreaker() {
        this.healthStatus.circuitBreakerOpen = true;
        this.healthStatus.lastCheckTime = new Date();
        logger_service_1.logger.error('Redis circuit breaker opened');
    }
    /**
     * Reset circuit breaker
     */
    static resetCircuitBreaker() {
        this.healthStatus.circuitBreakerOpen = false;
        this.healthStatus.consecutiveFailures = 0;
        this.healthStatus.isHealthy = true;
        this.healthStatus.lastCheckTime = new Date();
        logger_service_1.logger.info('Redis circuit breaker reset');
    }
    /**
     * Check if circuit breaker should be reset
     */
    static shouldResetCircuitBreaker(resetTimeMs) {
        const timeSinceOpen = Date.now() - this.healthStatus.lastCheckTime.getTime();
        return timeSinceOpen >= resetTimeMs;
    }
    /**
     * Sleep for specified milliseconds
     */
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Start health check monitoring
     */
    static startHealthCheck(config = {}) {
        const finalConfig = Object.assign(Object.assign({}, this.DEFAULT_CONFIG), config);
        if (this.healthCheckInterval) {
            this.stopHealthCheck();
        }
        logger_service_1.logger.info('Starting Redis health check monitoring');
        this.healthCheckInterval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
            try {
                // Simple ping to check Redis health
                yield redisWrapper_service_1.redisWrapper.client.ping();
                if (!this.healthStatus.isHealthy) {
                    logger_service_1.logger.info('Redis health check passed, marking as healthy');
                    this.recordSuccess();
                }
            }
            catch (error) {
                logger_service_1.logger.warn('Redis health check failed:', error);
                this.recordFailure();
                if (this.healthStatus.consecutiveFailures >= finalConfig.circuitBreakerThreshold) {
                    this.openCircuitBreaker();
                }
            }
        }), finalConfig.healthCheckIntervalMs);
    }
    /**
     * Stop health check monitoring
     */
    static stopHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
            logger_service_1.logger.info('Redis health check monitoring stopped');
        }
    }
    /**
     * Get current Redis health status
     */
    static getHealthStatus() {
        // Simple uptime calculation based on current health
        const uptimePercent = this.healthStatus.isHealthy ? 100 :
            Math.max(0, 100 - (this.healthStatus.consecutiveFailures * 10));
        return Object.assign(Object.assign({}, this.healthStatus), { uptimePercent, lastFailureTime: this.healthStatus.consecutiveFailures > 0 ?
                this.healthStatus.lastCheckTime : undefined });
    }
    /**
     * Force reset circuit breaker (for manual recovery)
     */
    static forceResetCircuitBreaker() {
        this.resetCircuitBreaker();
        logger_service_1.logger.info('Circuit breaker manually reset');
    }
    /**
     * Test Redis connection
     */
    static testConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            try {
                yield redisWrapper_service_1.redisWrapper.client.ping();
                return {
                    isConnected: true,
                    responseTime: Date.now() - startTime
                };
            }
            catch (error) {
                return {
                    isConnected: false,
                    responseTime: Date.now() - startTime,
                    error: error.message
                };
            }
        });
    }
}
exports.RedisFailoverManager = RedisFailoverManager;
RedisFailoverManager.DEFAULT_CONFIG = {
    maxRetries: 3,
    retryDelayMs: 1000,
    circuitBreakerThreshold: 5,
    circuitBreakerResetTimeMs: 30000, // 30 seconds
    healthCheckIntervalMs: 10000, // 10 seconds
    enableFallback: true
};
RedisFailoverManager.healthStatus = {
    isHealthy: true,
    lastCheckTime: new Date(),
    consecutiveFailures: 0,
    circuitBreakerOpen: false
};
RedisFailoverManager.healthCheckInterval = null;
