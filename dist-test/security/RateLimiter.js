"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStrictRateLimiter = exports.createAPIRateLimiter = exports.createUserRateLimiter = exports.createIPRateLimiter = exports.RateLimiter = void 0;
const logger_service_1 = require("../services/logger.service");
/**
 * Rate limiting service for controlling request frequency.
 *
 * Usage in microservices:
 * ```typescript
 * import { RateLimiter, redisWrapper } from '@xmoonx/moon-lib';
 *
 * const rateLimiter = new RateLimiter(this.redisClient, {
 *   windowMs: 15 * 60 * 1000, // 15 minutes
 *   maxRequests: 100
 * });
 *
 * // Use in routes
 * app.use('/api', rateLimiter.middleware());
 * ```
 */
class RateLimiter {
    constructor(redisClient, config) {
        this.redisClient = redisClient;
        this.config = Object.assign({ windowMs: 15 * 60 * 1000, maxRequests: 100, enabled: true, message: 'Too many requests, please try again later.', keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown', skipSuccessfulRequests: false, skipFailedRequests: false }, config);
    }
    /**
     * IP-based rate limiting
     */
    async checkIPRateLimit(ip, endpoint) {
        const key = `rate_limit:ip:${ip}:${endpoint}`;
        const now = Date.now();
        const windowStart = Math.floor(now / this.config.windowMs) * this.config.windowMs;
        const windowKey = `${key}:${windowStart}`;
        try {
            // Use separate commands instead of pipeline for better type safety
            const current = await this.redisClient.incr(windowKey);
            await this.redisClient.expire(windowKey, Math.ceil(this.config.windowMs / 1000));
            const timeUntilReset = windowStart + this.config.windowMs - now;
            const resetTime = new Date(windowStart + this.config.windowMs);
            return {
                allowed: current <= this.config.maxRequests,
                totalHits: current,
                timeUntilReset,
                resetTime
            };
        }
        catch (error) {
            logger_service_1.logger.error('Rate limit check error:', error);
            // Fail open - allow request if Redis is down
            return {
                allowed: true,
                totalHits: 0,
                timeUntilReset: this.config.windowMs,
                resetTime: new Date(Date.now() + this.config.windowMs)
            };
        }
    }
    /**
     * User-based rate limiting
     */
    async checkUserRateLimit(userId, endpoint) {
        const key = `rate_limit:user:${userId}:${endpoint}`;
        const now = Date.now();
        const windowStart = Math.floor(now / this.config.windowMs) * this.config.windowMs;
        const windowKey = `${key}:${windowStart}`;
        try {
            const current = await this.redisClient.incr(windowKey);
            await this.redisClient.expire(windowKey, Math.ceil(this.config.windowMs / 1000));
            const timeUntilReset = windowStart + this.config.windowMs - now;
            const resetTime = new Date(windowStart + this.config.windowMs);
            return {
                allowed: current <= this.config.maxRequests,
                totalHits: current,
                timeUntilReset,
                resetTime
            };
        }
        catch (error) {
            logger_service_1.logger.error('User rate limit check error:', error);
            // Fail open - allow request if Redis is down
            return {
                allowed: true,
                totalHits: 0,
                timeUntilReset: this.config.windowMs,
                resetTime: new Date(Date.now() + this.config.windowMs)
            };
        }
    }
    /**
     * API key-based rate limiting
     */
    async checkAPIKeyRateLimit(apiKey, endpoint) {
        const key = `rate_limit:api:${apiKey}:${endpoint}`;
        const now = Date.now();
        const windowStart = Math.floor(now / this.config.windowMs) * this.config.windowMs;
        const windowKey = `${key}:${windowStart}`;
        try {
            const current = await this.redisClient.incr(windowKey);
            await this.redisClient.expire(windowKey, Math.ceil(this.config.windowMs / 1000));
            const timeUntilReset = windowStart + this.config.windowMs - now;
            const resetTime = new Date(windowStart + this.config.windowMs);
            return {
                allowed: current <= this.config.maxRequests,
                totalHits: current,
                timeUntilReset,
                resetTime
            };
        }
        catch (error) {
            logger_service_1.logger.error('API key rate limit check error:', error);
            // Fail open - allow request if Redis is down
            return {
                allowed: true,
                totalHits: 0,
                timeUntilReset: this.config.windowMs,
                resetTime: new Date(Date.now() + this.config.windowMs)
            };
        }
    }
    /**
     * Global rate limiting
     */
    async checkGlobalRateLimit(endpoint) {
        const key = `rate_limit:global:${endpoint}`;
        const now = Date.now();
        const windowStart = Math.floor(now / this.config.windowMs) * this.config.windowMs;
        const windowKey = `${key}:${windowStart}`;
        try {
            const current = await this.redisClient.incr(windowKey);
            await this.redisClient.expire(windowKey, Math.ceil(this.config.windowMs / 1000));
            const timeUntilReset = windowStart + this.config.windowMs - now;
            const resetTime = new Date(windowStart + this.config.windowMs);
            return {
                allowed: current <= this.config.maxRequests,
                totalHits: current,
                timeUntilReset,
                resetTime
            };
        }
        catch (error) {
            logger_service_1.logger.error('Global rate limit check error:', error);
            // Fail open - allow request if Redis is down
            return {
                allowed: true,
                totalHits: 0,
                timeUntilReset: this.config.windowMs,
                resetTime: new Date(Date.now() + this.config.windowMs)
            };
        }
    }
    /**
     * Rate limiting middleware
     */
    middleware(options) {
        const config = Object.assign(Object.assign({}, this.config), options);
        return async (req, res, next) => {
            var _a;
            if (!config.enabled) {
                return next();
            }
            try {
                const ip = req.ip || req.connection.remoteAddress || 'unknown';
                const endpoint = ((_a = req.route) === null || _a === void 0 ? void 0 : _a.path) || req.path;
                // Generate key for rate limiting
                const key = config.keyGenerator ? config.keyGenerator(req) : ip;
                const result = await this.checkIPRateLimit(key, endpoint);
                // Set rate limit headers
                res.set({
                    'X-RateLimit-Limit': config.maxRequests.toString(),
                    'X-RateLimit-Remaining': Math.max(0, config.maxRequests - result.totalHits).toString(),
                    'X-RateLimit-Reset': result.resetTime.toISOString(),
                    'X-RateLimit-RetryAfter': Math.ceil(result.timeUntilReset / 1000).toString()
                });
                if (!result.allowed) {
                    logger_service_1.logger.warn('Rate limit exceeded:', {
                        ip,
                        endpoint,
                        totalHits: result.totalHits,
                        limit: config.maxRequests
                    });
                    return res.status(429).json({
                        error: config.message,
                        retryAfter: Math.ceil(result.timeUntilReset / 1000)
                    });
                }
                next();
            }
            catch (error) {
                logger_service_1.logger.error('Rate limiting middleware error:', error);
                // Fail open - continue with request if rate limiting fails
                next();
            }
        };
    }
    /**
     * User-specific rate limiting middleware
     */
    userMiddleware(options) {
        const config = Object.assign(Object.assign({}, this.config), options);
        return async (req, res, next) => {
            var _a, _b;
            if (!config.enabled) {
                return next();
            }
            try {
                const userId = (_a = req.currentUser) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    return next(); // Skip if no user
                }
                const endpoint = ((_b = req.route) === null || _b === void 0 ? void 0 : _b.path) || req.path;
                const result = await this.checkUserRateLimit(userId, endpoint);
                // Set rate limit headers
                res.set({
                    'X-RateLimit-Limit': config.maxRequests.toString(),
                    'X-RateLimit-Remaining': Math.max(0, config.maxRequests - result.totalHits).toString(),
                    'X-RateLimit-Reset': result.resetTime.toISOString(),
                    'X-RateLimit-RetryAfter': Math.ceil(result.timeUntilReset / 1000).toString()
                });
                if (!result.allowed) {
                    logger_service_1.logger.warn('User rate limit exceeded:', {
                        userId,
                        endpoint,
                        totalHits: result.totalHits,
                        limit: config.maxRequests
                    });
                    return res.status(429).json({
                        error: config.message,
                        retryAfter: Math.ceil(result.timeUntilReset / 1000)
                    });
                }
                next();
            }
            catch (error) {
                logger_service_1.logger.error('User rate limiting middleware error:', error);
                // Fail open - continue with request if rate limiting fails
                next();
            }
        };
    }
    /**
     * Reset rate limit for specific key
     */
    async resetRateLimit(key, endpoint) {
        try {
            const pattern = `rate_limit:*:${key}:${endpoint}:*`;
            const keys = await this.redisClient.keys(pattern);
            if (keys.length > 0) {
                await this.redisClient.del(keys);
                logger_service_1.logger.info('Rate limit reset for:', { key, endpoint });
            }
        }
        catch (error) {
            logger_service_1.logger.error('Rate limit reset error:', error);
        }
    }
    /**
     * Get current rate limit status
     */
    async getRateLimitStatus(key, endpoint) {
        try {
            const now = Date.now();
            const windowStart = Math.floor(now / this.config.windowMs) * this.config.windowMs;
            const windowKey = `rate_limit:ip:${key}:${endpoint}:${windowStart}`;
            const current = await this.redisClient.get(windowKey);
            const totalHits = current ? parseInt(current) : 0;
            const timeUntilReset = windowStart + this.config.windowMs - now;
            const resetTime = new Date(windowStart + this.config.windowMs);
            return {
                allowed: totalHits <= this.config.maxRequests,
                totalHits,
                timeUntilReset,
                resetTime
            };
        }
        catch (error) {
            logger_service_1.logger.error('Get rate limit status error:', error);
            return null;
        }
    }
}
exports.RateLimiter = RateLimiter;
/**
 * Factory functions for creating rate limiter instances.
 * These functions should be called with a redis client in microservices.
 *
 * Example usage in microservices:
 * ```typescript
 * import { createIPRateLimiter, redisWrapper } from '@xmoonx/moon-lib';
 *
 * const ipLimiter = createIPRateLimiter(redisWrapper.client);
 * app.use('/api', ipLimiter.middleware());
 * ```
 */
const createIPRateLimiter = (redisClient) => new RateLimiter(redisClient, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100
});
exports.createIPRateLimiter = createIPRateLimiter;
const createUserRateLimiter = (redisClient) => new RateLimiter(redisClient, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000
});
exports.createUserRateLimiter = createUserRateLimiter;
const createAPIRateLimiter = (redisClient) => new RateLimiter(redisClient, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10000
});
exports.createAPIRateLimiter = createAPIRateLimiter;
const createStrictRateLimiter = (redisClient) => new RateLimiter(redisClient, {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 10
});
exports.createStrictRateLimiter = createStrictRateLimiter;
//# sourceMappingURL=RateLimiter.js.map