/**
 * Optimized Security Service
 * 
 * Enhanced security service with performance optimizations including
 * Redis connection pooling, caching strategies, and batch operations.
 */

import { Request, Response, NextFunction } from 'express';
import { getRedisPool, RedisConnectionPool } from '../services/redisConnectionPool.service';
import { SecurityLogger } from '../security-logger/SecurityLogger';
import { SecurityEventType, SecurityEventSeverity } from '../security-logger/SecurityEventTypes';

export interface OptimizedSecurityConfig {
    serviceName: string;
    
    // Rate Limiting - Optimized
    maxRequestsPerWindow: number;
    requestWindowMs: number;
    enableRateLimitBatching: boolean;
    rateLimitBatchSize: number;
    rateLimitBatchIntervalMs: number;
    
    // Brute Force Protection - Optimized
    bruteForceMaxAttempts: number;
    bruteForceBlockDurationMs: number;
    bruteForceWindowMs: number;
    enableBruteForceCache: boolean;
    bruteForceCacheTTL: number;
    
    // CSRF Protection - Optimized
    enableCSRFProtection: boolean;
    csrfTokenTTL: number;
    csrfCacheSize: number;
    enableCSRFPreloading: boolean;
    
    // Performance Optimizations
    enableMetricsCache: boolean;
    metricsCacheTTL: number;
    enableAsyncLogging: boolean;
    enableConnectionPooling: boolean;
    
    // Redis Pool Configuration
    redisPoolConfig?: {
        maxConnections: number;
        minConnections: number;
        acquireTimeoutMs: number;
        idleTimeoutMs: number;
    };
}

interface SecurityMetricsCache {
    rateLimitViolations: Map<string, { count: number; lastUpdate: number }>;
    csrfViolations: Map<string, { count: number; lastUpdate: number }>;
    bruteForceAttempts: Map<string, { count: number; lastUpdate: number }>;
    generalMetrics: Map<string, { value: any; lastUpdate: number }>;
}

export class OptimizedSecurityService {
    private config: OptimizedSecurityConfig;
    private redisPool: RedisConnectionPool;
    private securityLogger: SecurityLogger;
    private metricsCache: SecurityMetricsCache;
    private rateLimitBatch: Map<string, number>;
    private batchProcessingInterval?: NodeJS.Timeout;
    private csrfTokenCache: Map<string, { token: string; expiresAt: number }>;
    private bruteForceCache: Map<string, { attempts: number; expiresAt: number }>;

    constructor(config: OptimizedSecurityConfig) {
        this.config = config;
        this.redisPool = getRedisPool(config.redisPoolConfig);
        this.securityLogger = new SecurityLogger(config.serviceName);
        
        // Initialize caches
        this.metricsCache = {
            rateLimitViolations: new Map(),
            csrfViolations: new Map(),
            bruteForceAttempts: new Map(),
            generalMetrics: new Map()
        };
        
        this.rateLimitBatch = new Map();
        this.csrfTokenCache = new Map();
        this.bruteForceCache = new Map();
        
        // Start batch processing if enabled
        if (config.enableRateLimitBatching) {
            this.startBatchProcessing();
        }
        
        // Start cache cleanup
        this.startCacheCleanup();
    }

    /**
     * Optimized rate limiting middleware
     */
    public getRateLimitMiddleware(): (req: Request, res: Response, next: NextFunction) => Promise<void> {
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                const clientId = this.getClientIdentifier(req);
                const isAllowed = await this.checkRateLimit(clientId);
                
                if (!isAllowed) {
                    // Log violation asynchronously if enabled
                    if (this.config.enableAsyncLogging) {
                        setImmediate(() => {
                            this.securityLogger.logRateLimitViolation(
                                req.ip || 'unknown',
                                req.originalUrl,
                                0, // Will be populated from Redis
                                this.config.maxRequestsPerWindow,
                                this.config.requestWindowMs
                            );
                        });
                    } else {
                        this.securityLogger.logRateLimitViolation(
                            req.ip || 'unknown',
                            req.originalUrl,
                            0,
                            this.config.maxRequestsPerWindow,
                            this.config.requestWindowMs
                        );
                    }
                    
                    return res.status(429).json({
                        error: 'Rate limit exceeded',
                        retryAfter: Math.ceil(this.config.requestWindowMs / 1000)
                    });
                }
                
                next();
            } catch (error) {
                this.securityLogger.error('Rate limiting error', error as Error);
                // Fail open - allow request if rate limiting fails
                next();
            }
        };
    }

    /**
     * Optimized brute force protection middleware
     */
    public getBruteForceMiddleware(): (req: Request, res: Response, next: NextFunction) => Promise<void> {
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                const identifier = this.getBruteForceIdentifier(req);
                const isBlocked = await this.checkBruteForce(identifier);
                
                if (isBlocked) {
                    if (this.config.enableAsyncLogging) {
                        setImmediate(() => {
                            this.securityLogger.logBruteForceAttempt(
                                req.ip || 'unknown',
                                identifier,
                                0, // Will be populated from cache/Redis
                                true,
                                this.config.bruteForceBlockDurationMs
                            );
                        });
                    } else {
                        this.securityLogger.logBruteForceAttempt(
                            req.ip || 'unknown',
                            identifier,
                            0,
                            true,
                            this.config.bruteForceBlockDurationMs
                        );
                    }
                    
                    return res.status(429).json({
                        error: 'Account temporarily locked due to too many failed attempts',
                        retryAfter: Math.ceil(this.config.bruteForceBlockDurationMs / 1000)
                    });
                }
                
                next();
            } catch (error) {
                this.securityLogger.error('Brute force protection error', error as Error);
                // Fail open - allow request if brute force protection fails
                next();
            }
        };
    }

    /**
     * Optimized rate limit check with batching and caching
     */
    private async checkRateLimit(clientId: string): Promise<boolean> {
        if (this.config.enableRateLimitBatching) {
            return this.checkRateLimitBatched(clientId);
        }
        
        return this.redisPool.execute(async (redis) => {
            const key = `rate_limit:${this.config.serviceName}:${clientId}`;
            const current = await redis.incr(key);
            
            if (current === 1) {
                await redis.pexpire(key, this.config.requestWindowMs);
            }
            
            return current <= this.config.maxRequestsPerWindow;
        });
    }

    /**
     * Batched rate limit checking for improved performance
     */
    private checkRateLimitBatched(clientId: string): boolean {
        const current = this.rateLimitBatch.get(clientId) || 0;
        this.rateLimitBatch.set(clientId, current + 1);
        
        return current < this.config.maxRequestsPerWindow;
    }

    /**
     * Optimized brute force check with caching
     */
    private async checkBruteForce(identifier: string): Promise<boolean> {
        // Check cache first
        if (this.config.enableBruteForceCache) {
            const cached = this.bruteForceCache.get(identifier);
            if (cached && Date.now() < cached.expiresAt) {
                return cached.attempts >= this.config.bruteForceMaxAttempts;
            }
        }
        
        return this.redisPool.execute(async (redis) => {
            const key = `brute_force:${this.config.serviceName}:${identifier}`;
            const attempts = parseInt(await redis.get(key) || '0');
            
            // Update cache
            if (this.config.enableBruteForceCache) {
                this.bruteForceCache.set(identifier, {
                    attempts,
                    expiresAt: Date.now() + this.config.bruteForceCacheTTL
                });
            }
            
            return attempts >= this.config.bruteForceMaxAttempts;
        });
    }

    /**
     * Record failed attempt with optimizations
     */
    public async recordFailedAttempt(identifier: string): Promise<void> {
        try {
            await this.redisPool.execute(async (redis) => {
                const key = `brute_force:${this.config.serviceName}:${identifier}`;
                const attempts = await redis.incr(key);
                
                if (attempts === 1) {
                    await redis.pexpire(key, this.config.bruteForceWindowMs);
                }
                
                // Update cache
                if (this.config.enableBruteForceCache) {
                    this.bruteForceCache.set(identifier, {
                        attempts,
                        expiresAt: Date.now() + this.config.bruteForceCacheTTL
                    });
                }
                
                // Log if threshold exceeded
                if (attempts >= this.config.bruteForceMaxAttempts) {
                    if (this.config.enableAsyncLogging) {
                        setImmediate(() => {
                            this.securityLogger.logBruteForceAttempt(
                                identifier,
                                identifier,
                                attempts,
                                true,
                                this.config.bruteForceBlockDurationMs
                            );
                        });
                    }
                }
            });
        } catch (error) {
            this.securityLogger.error('Failed to record brute force attempt', error as Error);
        }
    }

    /**
     * Reset brute force counter with cache invalidation
     */
    public async resetBruteForceCounter(identifier: string): Promise<void> {
        try {
            await this.redisPool.execute(async (redis) => {
                const key = `brute_force:${this.config.serviceName}:${identifier}`;
                await redis.del(key);
            });
            
            // Clear from cache
            this.bruteForceCache.delete(identifier);
        } catch (error) {
            this.securityLogger.error('Failed to reset brute force counter', error as Error);
        }
    }

    /**
     * Get optimized security metrics
     */
    public async getSecurityMetrics(): Promise<any> {
        if (this.config.enableMetricsCache) {
            const cached = this.metricsCache.generalMetrics.get('all');
            if (cached && Date.now() - cached.lastUpdate < this.config.metricsCacheTTL) {
                return cached.value;
            }
        }
        
        const metrics = await this.redisPool.execute(async (redis) => {
            const pipeline = redis.pipeline();
            
            // Get various metrics in a single pipeline
            pipeline.get(`metrics:${this.config.serviceName}:rate_limit_violations`);
            pipeline.get(`metrics:${this.config.serviceName}:csrf_violations`);
            pipeline.get(`metrics:${this.config.serviceName}:brute_force_attempts`);
            pipeline.get(`metrics:${this.config.serviceName}:total_requests`);
            
            const results = await pipeline.exec();
            
            return {
                rateLimitViolations: parseInt(results?.[0]?.[1] as string || '0'),
                csrfViolations: parseInt(results?.[1]?.[1] as string || '0'),
                bruteForceAttempts: parseInt(results?.[2]?.[1] as string || '0'),
                totalRequests: parseInt(results?.[3]?.[1] as string || '0'),
                timestamp: Date.now()
            };
        });
        
        // Cache the metrics
        if (this.config.enableMetricsCache) {
            this.metricsCache.generalMetrics.set('all', {
                value: metrics,
                lastUpdate: Date.now()
            });
        }
        
        return metrics;
    }

    /**
     * Batch processing for rate limiting
     */
    private startBatchProcessing(): void {
        this.batchProcessingInterval = setInterval(async () => {
            if (this.rateLimitBatch.size === 0) {
                return;
            }
            
            try {
                await this.redisPool.execute(async (redis) => {
                    const pipeline = redis.pipeline();
                    
                    this.rateLimitBatch.forEach((count, clientId) => {
                        const key = `rate_limit:${this.config.serviceName}:${clientId}`;
                        pipeline.incrby(key, count);
                        pipeline.pexpire(key, this.config.requestWindowMs);
                    });
                    
                    await pipeline.exec();
                });
                
                this.rateLimitBatch.clear();
            } catch (error) {
                this.securityLogger.error('Batch processing error', error as Error);
            }
        }, this.config.rateLimitBatchIntervalMs);
    }

    /**
     * Cache cleanup to prevent memory leaks
     */
    private startCacheCleanup(): void {
        setInterval(() => {
            const now = Date.now();
            
            // Clean CSRF token cache
            this.csrfTokenCache.forEach((value, key) => {
                if (now > value.expiresAt) {
                    this.csrfTokenCache.delete(key);
                }
            });
            
            // Clean brute force cache
            this.bruteForceCache.forEach((value, key) => {
                if (now > value.expiresAt) {
                    this.bruteForceCache.delete(key);
                }
            });
            
            // Clean metrics cache
            Object.values(this.metricsCache).forEach(cache => {
                cache.forEach((value, key) => {
                    if (now - value.lastUpdate > this.config.metricsCacheTTL) {
                        cache.delete(key);
                    }
                });
            });
        }, 60000); // Cleanup every minute
    }

    /**
     * Get client identifier for rate limiting
     */
    private getClientIdentifier(req: Request): string {
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';
        
        // Combine IP and User-Agent hash for more granular rate limiting
        return `${ip}:${this.hashString(userAgent)}`;
    }

    /**
     * Get brute force identifier
     */
    private getBruteForceIdentifier(req: Request): string {
        const ip = req.ip || 'unknown';
        const email = req.body?.email || req.body?.username || 'unknown';
        
        return `${ip}:${email}`;
    }

    /**
     * Simple string hash function
     */
    private hashString(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    /**
     * Cleanup resources
     */
    public async destroy(): Promise<void> {
        if (this.batchProcessingInterval) {
            clearInterval(this.batchProcessingInterval);
        }
        
        // Process any remaining batched operations
        if (this.rateLimitBatch.size > 0) {
            await this.redisPool.execute(async (redis) => {
                const pipeline = redis.pipeline();
                
                this.rateLimitBatch.forEach((count, clientId) => {
                    const key = `rate_limit:${this.config.serviceName}:${clientId}`;
                    pipeline.incrby(key, count);
                });
                
                await pipeline.exec();
            });
        }
    }
}