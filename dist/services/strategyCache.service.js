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
exports.strategyCacheService = exports.StrategyCacheService = void 0;
const lru_cache_1 = require("lru-cache");
const logger_service_1 = require("./logger.service");
/**
 * Strategy cache service for optimizing strategy resolution
 */
class StrategyCacheService {
    constructor(config) {
        this.warmupPromise = null;
        this.config = config;
        this.stats = {
            hits: 0,
            misses: 0,
            entries: 0,
            hitRate: 0,
            evictions: 0,
            memoryUsage: 0
        };
        this.cache = new lru_cache_1.LRUCache({
            max: config.maxSize,
            ttl: config.ttl * 1000, // Convert to milliseconds
            allowStale: false,
            updateAgeOnGet: true,
            updateAgeOnHas: true,
            dispose: (value, key) => {
                var _a;
                this.stats.evictions++;
                logger_service_1.logger.debug('Strategy cache entry evicted', { key, strategy: (_a = value === null || value === void 0 ? void 0 : value.strategy) === null || _a === void 0 ? void 0 : _a.entityType });
            }
        });
        logger_service_1.logger.info('Strategy cache initialized', {
            maxSize: config.maxSize,
            ttl: config.ttl,
            evictionPolicy: config.evictionPolicy,
            warmingEnabled: config.enableWarming
        });
    }
    /**
     * Get singleton instance
     */
    static getInstance(config) {
        if (!StrategyCacheService.instance) {
            StrategyCacheService.instance = new StrategyCacheService(config || {
                enabled: true,
                ttl: 300, // 5 minutes
                maxSize: 1000,
                evictionPolicy: 'lru',
                enableWarming: false
            });
        }
        return StrategyCacheService.instance;
    }
    /**
     * Get strategy from cache
     */
    get(entityType) {
        if (!this.config.enabled) {
            return null;
        }
        const cacheKey = this.generateCacheKey(entityType);
        const entry = this.cache.get(cacheKey);
        if (entry) {
            entry.hitCount++;
            entry.lastAccessed = Date.now();
            this.stats.hits++;
            this.updateHitRate();
            logger_service_1.logger.debug('Strategy cache hit', {
                entityType,
                strategy: entry.strategy.entityType,
                hitCount: entry.hitCount
            });
            return entry.strategy;
        }
        this.stats.misses++;
        this.updateHitRate();
        logger_service_1.logger.debug('Strategy cache miss', { entityType });
        return null;
    }
    /**
     * Put strategy in cache
     */
    set(entityType, strategy) {
        if (!this.config.enabled) {
            return;
        }
        const cacheKey = this.generateCacheKey(entityType);
        const entry = {
            strategy,
            timestamp: Date.now(),
            hitCount: 0,
            lastAccessed: Date.now()
        };
        this.cache.set(cacheKey, entry);
        this.stats.entries = this.cache.size;
        logger_service_1.logger.debug('Strategy cached', {
            entityType,
            strategy: strategy.entityType,
            serviceName: strategy.serviceName,
            cacheSize: this.cache.size
        });
    }
    /**
     * Check if strategy is cached
     */
    has(entityType) {
        if (!this.config.enabled) {
            return false;
        }
        const cacheKey = this.generateCacheKey(entityType);
        return this.cache.has(cacheKey);
    }
    /**
     * Remove strategy from cache
     */
    delete(entityType) {
        if (!this.config.enabled) {
            return false;
        }
        const cacheKey = this.generateCacheKey(entityType);
        const deleted = this.cache.delete(cacheKey);
        if (deleted) {
            this.stats.entries = this.cache.size;
            logger_service_1.logger.debug('Strategy removed from cache', { entityType });
        }
        return deleted;
    }
    /**
     * Clear all cached strategies
     */
    clear() {
        this.cache.clear();
        this.stats.entries = 0;
        logger_service_1.logger.info('Strategy cache cleared');
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return Object.assign(Object.assign({}, this.stats), { entries: this.cache.size, memoryUsage: this.estimateMemoryUsage() });
    }
    /**
     * Warm up cache with commonly used strategies
     */
    warmUp(strategies) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.config.enabled || !this.config.enableWarming) {
                return;
            }
            if (this.warmupPromise) {
                return this.warmupPromise;
            }
            this.warmupPromise = this.performWarmup(strategies);
            return this.warmupPromise;
        });
    }
    /**
     * Perform cache warmup
     */
    performWarmup(strategies) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_service_1.logger.info('Starting strategy cache warmup');
            const warmupStart = Date.now();
            let warmedUpCount = 0;
            for (const [entityType, strategiesArray] of strategies) {
                // Cache the highest priority strategy for each entity type
                if (strategiesArray.length > 0) {
                    const highestPriorityStrategy = strategiesArray.reduce((prev, current) => (current.priority > prev.priority) ? current : prev);
                    this.set(entityType, highestPriorityStrategy);
                    warmedUpCount++;
                }
            }
            const warmupTime = Date.now() - warmupStart;
            logger_service_1.logger.info('Strategy cache warmup completed', {
                strategiesWarmed: warmedUpCount,
                warmupTime,
                cacheSize: this.cache.size
            });
            this.warmupPromise = null;
        });
    }
    /**
     * Preload strategies based on usage patterns
     */
    preloadStrategies(entityTypes, strategiesMap) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.config.enabled) {
                return;
            }
            logger_service_1.logger.info('Preloading strategies for entity types', { entityTypes });
            for (const entityType of entityTypes) {
                const strategies = strategiesMap.get(entityType);
                if (strategies && strategies.length > 0) {
                    // Cache the highest priority strategy
                    const bestStrategy = strategies[0]; // Assuming they're sorted by priority
                    this.set(entityType, bestStrategy);
                }
            }
        });
    }
    /**
     * Get cache performance report
     */
    getPerformanceReport() {
        const entries = Array.from(this.cache.entries());
        const topStrategies = entries
            .map(([key, entry]) => ({
            entityType: key,
            strategy: entry.strategy.entityType,
            hitCount: entry.hitCount,
            lastAccessed: entry.lastAccessed
        }))
            .sort((a, b) => b.hitCount - a.hitCount)
            .slice(0, 10);
        const hitRate = this.stats.hitRate;
        const missRate = 100 - hitRate;
        let efficiency = 'Poor';
        if (hitRate > 90)
            efficiency = 'Excellent';
        else if (hitRate > 80)
            efficiency = 'Good';
        else if (hitRate > 70)
            efficiency = 'Fair';
        return {
            stats: this.getStats(),
            topStrategies: topStrategies,
            cacheEfficiency: {
                hitRate,
                missRate,
                efficiency
            }
        };
    }
    /**
     * Optimize cache based on usage patterns
     */
    optimizeCache() {
        const entries = Array.from(this.cache.entries());
        const now = Date.now();
        const ttlMs = this.config.ttl * 1000;
        // Remove stale entries that haven't been accessed recently
        let removedCount = 0;
        for (const [key, entry] of entries) {
            if (now - entry.lastAccessed > ttlMs * 2) {
                this.cache.delete(key);
                removedCount++;
            }
        }
        logger_service_1.logger.info('Cache optimization completed', {
            removedEntries: removedCount,
            remainingEntries: this.cache.size
        });
    }
    /**
     * Generate cache key for entity type
     */
    generateCacheKey(entityType) {
        return `strategy:${entityType}`;
    }
    /**
     * Update hit rate statistics
     */
    updateHitRate() {
        const total = this.stats.hits + this.stats.misses;
        this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    }
    /**
     * Estimate memory usage of cache
     */
    estimateMemoryUsage() {
        // Rough estimation of memory usage
        const entries = this.cache.size;
        const avgEntrySize = 1024; // Estimated bytes per entry
        return entries * avgEntrySize;
    }
    /**
     * Get cache configuration
     */
    getConfig() {
        return Object.assign({}, this.config);
    }
    /**
     * Update cache configuration
     */
    updateConfig(newConfig) {
        this.config = Object.assign(Object.assign({}, this.config), newConfig);
        // Recreate cache with new configuration
        if (newConfig.maxSize || newConfig.ttl) {
            const oldEntries = Array.from(this.cache.entries());
            this.cache = new lru_cache_1.LRUCache({
                max: this.config.maxSize,
                ttl: this.config.ttl * 1000,
                allowStale: false,
                updateAgeOnGet: true,
                updateAgeOnHas: true,
                dispose: (value, key) => {
                    var _a;
                    this.stats.evictions++;
                    logger_service_1.logger.debug('Strategy cache entry evicted', { key, strategy: (_a = value === null || value === void 0 ? void 0 : value.strategy) === null || _a === void 0 ? void 0 : _a.entityType });
                }
            });
            // Restore entries
            for (const [key, entry] of oldEntries) {
                this.cache.set(key, entry);
            }
        }
        logger_service_1.logger.info('Cache configuration updated', newConfig);
    }
    /**
     * Get cache metrics for monitoring
     */
    getMetrics() {
        return {
            cache_hits: this.stats.hits,
            cache_misses: this.stats.misses,
            cache_entries: this.cache.size,
            cache_hit_rate: this.stats.hitRate,
            cache_evictions: this.stats.evictions,
            cache_memory_usage: this.estimateMemoryUsage()
        };
    }
    /**
     * Reset cache statistics
     */
    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            entries: this.cache.size,
            hitRate: 0,
            evictions: 0,
            memoryUsage: 0
        };
        logger_service_1.logger.info('Cache statistics reset');
    }
    /**
     * Schedule cache cleanup
     */
    scheduleCleanup(intervalMs = 60000) {
        return setInterval(() => {
            this.optimizeCache();
        }, intervalMs);
    }
    /**
     * Bulk cache operations
     */
    bulkSet(strategies) {
        if (!this.config.enabled) {
            return;
        }
        const startTime = Date.now();
        let cachedCount = 0;
        for (const [entityType, strategy] of strategies) {
            this.set(entityType, strategy);
            cachedCount++;
        }
        const bulkTime = Date.now() - startTime;
        logger_service_1.logger.info('Bulk cache operation completed', {
            strategiesCached: cachedCount,
            bulkTime,
            cacheSize: this.cache.size
        });
    }
    /**
     * Export cache entries for backup
     */
    exportCache() {
        const entries = Array.from(this.cache.entries());
        return entries.map(([key, entry]) => ({
            entityType: key.replace('strategy:', ''),
            strategy: entry.strategy,
            metadata: {
                timestamp: entry.timestamp,
                hitCount: entry.hitCount,
                lastAccessed: entry.lastAccessed
            }
        }));
    }
    /**
     * Import cache entries from backup
     */
    importCache(entries) {
        if (!this.config.enabled) {
            return;
        }
        let importedCount = 0;
        for (const entry of entries) {
            const cacheKey = this.generateCacheKey(entry.entityType);
            const cacheEntry = {
                strategy: entry.strategy,
                timestamp: entry.metadata.timestamp,
                hitCount: entry.metadata.hitCount,
                lastAccessed: entry.metadata.lastAccessed
            };
            this.cache.set(cacheKey, cacheEntry);
            importedCount++;
        }
        this.stats.entries = this.cache.size;
        logger_service_1.logger.info('Cache import completed', {
            entriesImported: importedCount,
            cacheSize: this.cache.size
        });
    }
}
exports.StrategyCacheService = StrategyCacheService;
// Export singleton instance
exports.strategyCacheService = StrategyCacheService.getInstance();
