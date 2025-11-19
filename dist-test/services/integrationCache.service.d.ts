import { LRUCache } from 'lru-cache';
/**
 * Integration Cache Service
 *
 * LRU (Least Recently Used) cache implementation for Integration instances.
 * Prevents creating multiple Integration instances per user/platform, which:
 * - Reduces memory usage
 * - Shares PQueue instances (proper rate limiting)
 * - Reuses authenticated API clients (token persistence)
 *
 * Features:
 * - Automatic eviction of least recently used instances
 * - TTL (Time To Live) for inactive instances
 * - Max size limit to control memory usage
 * - Age renewal on access (keep active instances)
 *
 * Memory Estimation:
 * - Each integration instance: ~15 KB
 * - Max 1000 instances: ~15 MB RAM
 *
 * Usage:
 * ```typescript
 * const cache = new IntegrationCacheService<ParasutIntegration>({
 *     max: 1000,
 *     ttl: 1000 * 60 * 60  // 1 hour
 * });
 *
 * const cacheKey = `${userId}-${platform}`;
 * let integration = cache.get(cacheKey);
 * if (!integration) {
 *     integration = await new ParasutIntegration().setup(...);
 *     cache.set(cacheKey, integration);
 * }
 * ```
 */
export declare class IntegrationCacheService<T extends object> {
    private cache;
    private serviceName;
    constructor(serviceName: string, options: {
        max: number;
        ttl: number;
    });
    /**
     * Get integration instance from cache
     * @param key - Cache key (usually `${userId}-${platform}`)
     * @returns Integration instance or undefined if not found
     */
    get(key: string): T | undefined;
    /**
     * Set integration instance in cache
     * @param key - Cache key (usually `${userId}-${platform}`)
     * @param value - Integration instance
     */
    set(key: string, value: T): void;
    /**
     * Check if key exists in cache (without updating age)
     * @param key - Cache key
     * @returns true if key exists
     */
    has(key: string): boolean;
    /**
     * Invalidate (delete) integration instance from cache
     * Use this when user updates credentials or wants to force re-authentication
     *
     * @param key - Cache key (usually `${userId}-${platform}`)
     * @returns true if item was deleted, false if not found
     */
    invalidate(key: string): boolean;
    /**
     * Invalidate all cache entries for a specific user (all platforms)
     * @param userId - User ID
     * @returns Number of invalidated entries
     */
    invalidateUser(userId: string): number;
    /**
     * Clear entire cache (all users, all platforms)
     * Use with caution - this forces re-authentication for all cached integrations
     */
    clear(): void;
    /**
     * Get cache statistics
     */
    getStats(): {
        size: number;
        max: number;
        ttl: number;
        calculatedSize: number;
    };
    /**
     * Override this method in subclass to implement custom disposal logic
     * Called when an integration instance is evicted from cache
     *
     * @param value - Integration instance being disposed
     * @param key - Cache key
     * @param reason - Eviction reason (evict, set, delete)
     */
    protected onDispose(value: T, key: string, reason: LRUCache.DisposeReason): void;
}
//# sourceMappingURL=integrationCache.service.d.ts.map