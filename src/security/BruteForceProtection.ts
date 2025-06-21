import { Request, Response, NextFunction } from 'express';
import { RedisClientType } from 'redis';
import { logger } from '../services/logger.service';

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
export class BruteForceProtection {
    private config: Required<BruteForceConfig>;
    private redisClient: RedisClientType;

    constructor (redisClient: RedisClientType, config?: Partial<BruteForceConfig>) {
        this.redisClient = redisClient;
        this.config = {
            maxAttempts: 5,
            windowMs: 15 * 60 * 1000, // 15 minutes
            blockDurationMs: 30 * 60 * 1000, // 30 minutes
            enabled: true,
            skipSuccessfulRequests: false,
            ...config
        };
    }

    /**
     * Check if IP is currently blocked
     */
    async isBlocked(ip: string): Promise<boolean> {
        try {
            const blockKey = `brute_force:block:${ip}`;
            const blocked = await this.redisClient.get(blockKey);
            return blocked !== null;
        } catch (error) {
            logger.error('Brute force block check error:', error);
            return false; // Fail open
        }
    }

    /**
     * Get current attempt count for IP
     */
    async getAttemptCount(ip: string): Promise<number> {
        try {
            const attemptKey = `brute_force:attempts:${ip}`;
            const attempts = await this.redisClient.get(attemptKey);
            return attempts ? parseInt(attempts) : 0;
        } catch (error) {
            logger.error('Get attempt count error:', error);
            return 0;
        }
    }

    /**
     * Record a failed attempt
     */
    async recordFailedAttempt(ip: string): Promise<BruteForceResult> {
        try {
            const attemptKey = `brute_force:attempts:${ip}`;
            const blockKey = `brute_force:block:${ip}`;

            // Check if already blocked
            if (await this.isBlocked(ip)) {
                const ttl = await this.redisClient.ttl(blockKey);
                return {
                    allowed: false,
                    attemptsRemaining: 0,
                    timeUntilReset: ttl * 1000,
                    isBlocked: true,
                    blockExpiresAt: new Date(Date.now() + (ttl * 1000))
                };
            }

            // Increment attempt count
            const attempts = await this.redisClient.incr(attemptKey);
            await this.redisClient.expire(attemptKey, Math.ceil(this.config.windowMs / 1000));

            // Check if should be blocked
            if (attempts >= this.config.maxAttempts) {
                // Block the IP
                await this.redisClient.setEx(
                    blockKey,
                    Math.ceil(this.config.blockDurationMs / 1000),
                    'blocked'
                );

                // Clear attempt count
                await this.redisClient.del(attemptKey);

                logger.warn('IP blocked due to brute force attempts:', {
                    ip,
                    attempts,
                    blockDuration: this.config.blockDurationMs
                });

                return {
                    allowed: false,
                    attemptsRemaining: 0,
                    timeUntilReset: this.config.blockDurationMs,
                    isBlocked: true,
                    blockExpiresAt: new Date(Date.now() + this.config.blockDurationMs)
                };
            }

            return {
                allowed: true,
                attemptsRemaining: this.config.maxAttempts - attempts,
                timeUntilReset: this.config.windowMs,
                isBlocked: false
            };

        } catch (error) {
            logger.error('Record failed attempt error:', error);
            return {
                allowed: true,
                attemptsRemaining: this.config.maxAttempts,
                timeUntilReset: this.config.windowMs,
                isBlocked: false
            };
        }
    }

    /**
     * Record a successful attempt (reset counter)
     */
    async recordSuccessfulAttempt(ip: string): Promise<void> {
        if (this.config.skipSuccessfulRequests) {
            return;
        }

        try {
            const attemptKey = `brute_force:attempts:${ip}`;
            await this.redisClient.del(attemptKey);
            logger.debug('Successful attempt recorded, counter reset:', { ip });
        } catch (error) {
            logger.error('Record successful attempt error:', error);
        }
    }

    /**
     * Manually unblock an IP
     */
    async unblockIP(ip: string): Promise<void> {
        try {
            const blockKey = `brute_force:block:${ip}`;
            const attemptKey = `brute_force:attempts:${ip}`;

            await Promise.all([
                this.redisClient.del(blockKey),
                this.redisClient.del(attemptKey)
            ]);

            logger.info('IP manually unblocked:', { ip });
        } catch (error) {
            logger.error('Manual unblock error:', error);
        }
    }

    /**
     * Get current status for IP
     */
    async getStatus(ip: string): Promise<BruteForceResult> {
        try {
            const isCurrentlyBlocked = await this.isBlocked(ip);

            if (isCurrentlyBlocked) {
                const blockKey = `brute_force:block:${ip}`;
                const ttl = await this.redisClient.ttl(blockKey);
                return {
                    allowed: false,
                    attemptsRemaining: 0,
                    timeUntilReset: ttl * 1000,
                    isBlocked: true,
                    blockExpiresAt: new Date(Date.now() + (ttl * 1000))
                };
            }

            const attempts = await this.getAttemptCount(ip);
            return {
                allowed: true,
                attemptsRemaining: this.config.maxAttempts - attempts,
                timeUntilReset: this.config.windowMs,
                isBlocked: false
            };

        } catch (error) {
            logger.error('Get brute force status error:', error);
            return {
                allowed: true,
                attemptsRemaining: this.config.maxAttempts,
                timeUntilReset: this.config.windowMs,
                isBlocked: false
            };
        }
    }

    /**
     * Middleware for protecting login endpoints
     */
    loginProtection() {
        return async (req: Request, res: Response, next: NextFunction) => {
            if (!this.config.enabled) {
                return next();
            }

            try {
                const ip = req.ip || req.connection.remoteAddress || 'unknown';
                const status = await this.getStatus(ip);

                if (!status.allowed) {
                    logger.warn('Login attempt blocked due to brute force protection:', {
                        ip,
                        isBlocked: status.isBlocked,
                        blockExpiresAt: status.blockExpiresAt
                    });

                    return res.status(429).json({
                        error: 'Too many failed login attempts. Please try again later.',
                        retryAfter: Math.ceil(status.timeUntilReset / 1000),
                        blockExpiresAt: status.blockExpiresAt
                    });
                }

                // Store IP in request for later use
                (req as any).clientIP = ip;
                next();
            } catch (error) {
                logger.error('Brute force protection middleware error:', error);
                // Fail open - continue with request
                next();
            }
        };
    }

    /**
     * Middleware for handling failed login responses
     */
    handleFailedLogin() {
        const bruteForceInstance = this; // Capture this context
        return async (req: Request, res: Response, next: NextFunction) => {
            // This middleware should be used after login processing
            // to record failed attempts based on response status

            const originalSend = res.send.bind(res);
            const ip = (req as any).clientIP || req.ip || req.connection.remoteAddress || 'unknown';

            res.send = function (body: any) {
                // Check if this is a failed login (you may need to adjust this logic)
                if (res.statusCode === 401 || res.statusCode === 400) {
                    // Record failed attempt asynchronously
                    setImmediate(async () => {
                        try {
                            await bruteForceInstance.recordFailedAttempt(ip);
                        } catch (error) {
                            logger.error('Failed to record brute force attempt:', error);
                        }
                    });
                } else if (res.statusCode === 200 || res.statusCode === 201) {
                    // Record successful attempt asynchronously
                    setImmediate(async () => {
                        try {
                            await bruteForceInstance.recordSuccessfulAttempt(ip);
                        } catch (error) {
                            logger.error('Failed to record successful attempt:', error);
                        }
                    });
                }

                return originalSend(body);
            };

            next();
        };
    }

    /**
     * Get blocked IPs list
     */
    async getBlockedIPs(): Promise<Array<{ ip: string; expiresAt: Date }>> {
        try {
            const pattern = 'brute_force:block:*';
            const keys = await this.redisClient.keys(pattern);

            const blockedIPs = [];
            for (const key of keys) {
                const ip = key.replace('brute_force:block:', '');
                const ttl = await this.redisClient.ttl(key);
                if (ttl > 0) {
                    blockedIPs.push({
                        ip,
                        expiresAt: new Date(Date.now() + (ttl * 1000))
                    });
                }
            }

            return blockedIPs;
        } catch (error) {
            logger.error('Get blocked IPs error:', error);
            return [];
        }
    }

    /**
     * Clear all brute force data
     */
    async clearAll(): Promise<void> {
        try {
            const patterns = [
                'brute_force:attempts:*',
                'brute_force:block:*'
            ];

            for (const pattern of patterns) {
                const keys = await this.redisClient.keys(pattern);
                if (keys.length > 0) {
                    await this.redisClient.del(keys);
                }
            }

            logger.info('All brute force protection data cleared');
        } catch (error) {
            logger.error('Clear brute force data error:', error);
        }
    }
}

// Factory functions for creating BruteForceProtection instances with common configurations
export const createBruteForceProtection = (redisClient: RedisClientType) => new BruteForceProtection(redisClient);

export const createStrictBruteForceProtection = (redisClient: RedisClientType) => new BruteForceProtection(redisClient, {
    maxAttempts: 3,
    windowMs: 10 * 60 * 1000, // 10 minutes
    blockDurationMs: 60 * 60 * 1000 // 1 hour
});

export const createLenientBruteForceProtection = (redisClient: RedisClientType) => new BruteForceProtection(redisClient, {
    maxAttempts: 10,
    windowMs: 30 * 60 * 1000, // 30 minutes
    blockDurationMs: 15 * 60 * 1000 // 15 minutes
});
