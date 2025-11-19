"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationCacheService = void 0;
const lru_cache_1 = require("lru-cache");
const logger_service_1 = require("./logger.service");
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
class IntegrationCacheService {
    constructor(serviceName, options) {
        this.serviceName = serviceName;
        this.cache = new lru_cache_1.LRUCache({
            max: options.max,
            ttl: options.ttl,
            updateAgeOnGet: true, // Renew TTL when accessed
            updateAgeOnHas: false, // Don't renew TTL on has() check
            allowStale: false, // Don't return stale items
            // Disposal handler - called when item is evicted from cache
            dispose: (value, key, reason) => {
                logger_service_1.logger.info(`[${this.serviceName}] Integration instance evicted from cache`, {
                    key,
                    reason,
                    cacheSize: this.cache.size,
                    maxSize: this.cache.max
                });
                // Cleanup logic (optional - override in subclass if needed)
                this.onDispose(value, key, reason);
            }
        });
        logger_service_1.logger.info(`[${this.serviceName}] Integration cache initialized`, {
            maxSize: options.max,
            ttl: options.ttl,
            ttlMinutes: Math.round(options.ttl / 1000 / 60)
        });
    }
    /**
     * Get integration instance from cache
     * @param key - Cache key (usually `${userId}-${platform}`)
     * @returns Integration instance or undefined if not found
     */
    get(key) {
        const instance = this.cache.get(key);
        if (instance) {
            logger_service_1.logger.debug(`[${this.serviceName}] Cache HIT`, {
                key,
                cacheSize: this.cache.size,
                remainingTTL: this.cache.getRemainingTTL(key)
            });
        }
        else {
            logger_service_1.logger.debug(`[${this.serviceName}] Cache MISS`, {
                key,
                cacheSize: this.cache.size
            });
        }
        return instance;
    }
    /**
     * Set integration instance in cache
     * @param key - Cache key (usually `${userId}-${platform}`)
     * @param value - Integration instance
     */
    set(key, value) {
        this.cache.set(key, value);
        logger_service_1.logger.info(`[${this.serviceName}] Integration cached`, {
            key,
            cacheSize: this.cache.size,
            maxSize: this.cache.max,
            ttl: this.cache.ttl
        });
    }
    /**
     * Check if key exists in cache (without updating age)
     * @param key - Cache key
     * @returns true if key exists
     */
    has(key) {
        return this.cache.has(key);
    }
    /**
     * Invalidate (delete) integration instance from cache
     * Use this when user updates credentials or wants to force re-authentication
     *
     * @param key - Cache key (usually `${userId}-${platform}`)
     * @returns true if item was deleted, false if not found
     */
    invalidate(key) {
        const existed = this.cache.delete(key);
        if (existed) {
            logger_service_1.logger.info(`[${this.serviceName}] Integration invalidated`, {
                key,
                cacheSize: this.cache.size
            });
        }
        else {
            logger_service_1.logger.debug(`[${this.serviceName}] Invalidation requested but key not found`, {
                key
            });
        }
        return existed;
    }
    /**
     * Invalidate all cache entries for a specific user (all platforms)
     * @param userId - User ID
     * @returns Number of invalidated entries
     */
    invalidateUser(userId) {
        let count = 0;
        const keysToDelete = [];
        // Find all keys for this user
        for (const key of this.cache.keys()) {
            if (key.startsWith(`${userId}-`)) {
                keysToDelete.push(key);
            }
        }
        // Delete all found keys
        for (const key of keysToDelete) {
            if (this.cache.delete(key)) {
                count++;
            }
        }
        if (count > 0) {
            logger_service_1.logger.info(`[${this.serviceName}] User integrations invalidated`, {
                userId,
                count,
                cacheSize: this.cache.size
            });
        }
        return count;
    }
    /**
     * Clear entire cache (all users, all platforms)
     * Use with caution - this forces re-authentication for all cached integrations
     */
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        logger_service_1.logger.warn(`[${this.serviceName}] Entire cache cleared`, {
            clearedCount: size
        });
    }
    /**
     * Get cache statistics
     */
    getStats() {
        var _a, _b;
        return {
            size: this.cache.size,
            max: this.cache.max,
            ttl: (_a = this.cache.ttl) !== null && _a !== void 0 ? _a : 0,
            calculatedSize: (_b = this.cache.calculatedSize) !== null && _b !== void 0 ? _b : 0
        };
    }
    /**
     * Override this method in subclass to implement custom disposal logic
     * Called when an integration instance is evicted from cache
     *
     * @param value - Integration instance being disposed
     * @param key - Cache key
     * @param reason - Eviction reason (evict, set, delete)
     */
    onDispose(value, key, reason) {
        // Default: no-op
        // Subclasses can override to implement cleanup logic
    }
}
exports.IntegrationCacheService = IntegrationCacheService;
//# sourceMappingURL=integrationCache.service.js.map