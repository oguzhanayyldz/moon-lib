import { StrategyCacheConfig } from '../common/interfaces/batch-deletion.interface';
import { EntityDeletionStrategy } from '../common/interfaces/entity-deletion.interface';
/**
 * Cache statistics
 */
interface CacheStats {
    hits: number;
    misses: number;
    entries: number;
    hitRate: number;
    evictions: number;
    memoryUsage: number;
}
/**
 * Strategy cache service for optimizing strategy resolution
 */
export declare class StrategyCacheService {
    private static instance;
    private cache;
    private config;
    private stats;
    private warmupPromise;
    private constructor();
    /**
     * Get singleton instance
     */
    static getInstance(config?: StrategyCacheConfig): StrategyCacheService;
    /**
     * Get strategy from cache
     */
    get(entityType: string): EntityDeletionStrategy | null;
    /**
     * Put strategy in cache
     */
    set(entityType: string, strategy: EntityDeletionStrategy): void;
    /**
     * Check if strategy is cached
     */
    has(entityType: string): boolean;
    /**
     * Remove strategy from cache
     */
    delete(entityType: string): boolean;
    /**
     * Clear all cached strategies
     */
    clear(): void;
    /**
     * Get cache statistics
     */
    getStats(): CacheStats;
    /**
     * Warm up cache with commonly used strategies
     */
    warmUp(strategies: Map<string, EntityDeletionStrategy[]>): Promise<void>;
    /**
     * Perform cache warmup
     */
    private performWarmup;
    /**
     * Preload strategies based on usage patterns
     */
    preloadStrategies(entityTypes: string[], strategiesMap: Map<string, EntityDeletionStrategy[]>): Promise<void>;
    /**
     * Get cache performance report
     */
    getPerformanceReport(): {
        stats: CacheStats;
        topStrategies: Array<{
            entityType: string;
            strategy: string;
            hitCount: number;
            lastAccessed: number;
        }>;
        cacheEfficiency: {
            hitRate: number;
            missRate: number;
            efficiency: string;
        };
    };
    /**
     * Optimize cache based on usage patterns
     */
    optimizeCache(): void;
    /**
     * Generate cache key for entity type
     */
    private generateCacheKey;
    /**
     * Update hit rate statistics
     */
    private updateHitRate;
    /**
     * Estimate memory usage of cache
     */
    private estimateMemoryUsage;
    /**
     * Get cache configuration
     */
    getConfig(): StrategyCacheConfig;
    /**
     * Update cache configuration
     */
    updateConfig(newConfig: Partial<StrategyCacheConfig>): void;
    /**
     * Get cache metrics for monitoring
     */
    getMetrics(): Record<string, number>;
    /**
     * Reset cache statistics
     */
    resetStats(): void;
    /**
     * Schedule cache cleanup
     */
    scheduleCleanup(intervalMs?: number): NodeJS.Timeout;
    /**
     * Bulk cache operations
     */
    bulkSet(strategies: Map<string, EntityDeletionStrategy>): void;
    /**
     * Export cache entries for backup
     */
    exportCache(): Array<{
        entityType: string;
        strategy: EntityDeletionStrategy;
        metadata: {
            timestamp: number;
            hitCount: number;
            lastAccessed: number;
        };
    }>;
    /**
     * Import cache entries from backup
     */
    importCache(entries: Array<{
        entityType: string;
        strategy: EntityDeletionStrategy;
        metadata: {
            timestamp: number;
            hitCount: number;
            lastAccessed: number;
        };
    }>): void;
}
export declare const strategyCacheService: StrategyCacheService;
export {};
//# sourceMappingURL=strategyCache.service.d.ts.map