import { Request, Response, NextFunction } from 'express';
import { RedisClientType } from 'redis';
export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    keyGenerator?: (req: Request) => string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
    enabled?: boolean;
    message?: string;
}
export interface RateLimitResult {
    allowed: boolean;
    totalHits: number;
    timeUntilReset: number;
    resetTime: Date;
}
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
export declare class RateLimiter {
    private config;
    private redisClient;
    constructor(redisClient: RedisClientType, config?: Partial<RateLimitConfig>);
    /**
     * IP-based rate limiting
     */
    checkIPRateLimit(ip: string, endpoint: string): Promise<RateLimitResult>;
    /**
     * User-based rate limiting
     */
    checkUserRateLimit(userId: string, endpoint: string): Promise<RateLimitResult>;
    /**
     * API key-based rate limiting
     */
    checkAPIKeyRateLimit(apiKey: string, endpoint: string): Promise<RateLimitResult>;
    /**
     * Global rate limiting
     */
    checkGlobalRateLimit(endpoint: string): Promise<RateLimitResult>;
    /**
     * Rate limiting middleware
     */
    middleware(options?: Partial<RateLimitConfig>): (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
    /**
     * User-specific rate limiting middleware
     */
    userMiddleware(options?: Partial<RateLimitConfig>): (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
    /**
     * Reset rate limit for specific key
     */
    resetRateLimit(key: string, endpoint: string): Promise<void>;
    /**
     * Get current rate limit status
     */
    getRateLimitStatus(key: string, endpoint: string): Promise<RateLimitResult | null>;
}
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
export declare const createIPRateLimiter: (redisClient: RedisClientType) => RateLimiter;
export declare const createUserRateLimiter: (redisClient: RedisClientType) => RateLimiter;
export declare const createAPIRateLimiter: (redisClient: RedisClientType) => RateLimiter;
export declare const createStrictRateLimiter: (redisClient: RedisClientType) => RateLimiter;
//# sourceMappingURL=RateLimiter.d.ts.map