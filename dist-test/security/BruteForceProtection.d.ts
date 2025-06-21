import { Request, Response, NextFunction } from 'express';
import { RedisClientType } from 'redis';
export interface BruteForceConfig {
    maxAttempts?: number;
    windowMs?: number;
    blockDurationMs?: number;
    enabled?: boolean;
    skipSuccessfulRequests?: boolean;
}
export interface BruteForceResult {
    allowed: boolean;
    attemptsRemaining: number;
    timeUntilReset: number;
    isBlocked: boolean;
    blockExpiresAt?: Date;
}
/**
 * Brute force protection service for preventing automated attacks.
 *
 * Usage in microservices:
 * ```typescript
 * import { BruteForceProtection, redisWrapper } from '@xmoonx/moon-lib';
 *
 * const bruteForceProtection = new BruteForceProtection(redisWrapper.client, {
 *   maxAttempts: 5,
 *   blockDurationMs: 30 * 60 * 1000 // 30 minutes
 * });
 *
 * // Use in login routes
 * app.use('/auth/login', bruteForceProtection.loginProtection());
 * ```
 */
export declare class BruteForceProtection {
    private config;
    private redisClient;
    constructor(redisClient: RedisClientType, config?: Partial<BruteForceConfig>);
    /**
     * Check if IP is currently blocked
     */
    isBlocked(ip: string): Promise<boolean>;
    /**
     * Get current attempt count for IP
     */
    getAttemptCount(ip: string): Promise<number>;
    /**
     * Record a failed attempt
     */
    recordFailedAttempt(ip: string): Promise<BruteForceResult>;
    /**
     * Record a successful attempt (reset counter)
     */
    recordSuccessfulAttempt(ip: string): Promise<void>;
    /**
     * Manually unblock an IP
     */
    unblockIP(ip: string): Promise<void>;
    /**
     * Get current status for IP
     */
    getStatus(ip: string): Promise<BruteForceResult>;
    /**
     * Middleware for protecting login endpoints
     */
    loginProtection(): (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
    /**
     * Middleware for handling failed login responses
     */
    handleFailedLogin(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Get blocked IPs list
     */
    getBlockedIPs(): Promise<Array<{
        ip: string;
        expiresAt: Date;
    }>>;
    /**
     * Clear all brute force data
     */
    clearAll(): Promise<void>;
}
export declare const createBruteForceProtection: (redisClient: RedisClientType) => BruteForceProtection;
export declare const createStrictBruteForceProtection: (redisClient: RedisClientType) => BruteForceProtection;
export declare const createLenientBruteForceProtection: (redisClient: RedisClientType) => BruteForceProtection;
//# sourceMappingURL=BruteForceProtection.d.ts.map