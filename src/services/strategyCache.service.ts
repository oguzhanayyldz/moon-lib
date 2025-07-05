import { LRUCache } from 'lru-cache';
import { StrategyCacheConfig } from '../common/interfaces/batch-deletion.interface';
import { EntityDeletionStrategy } from '../common/interfaces/entity-deletion.interface';
import { logger } from './logger.service';

/**
 * Cache entry for strategy resolution
 */
interface StrategyCacheEntry {
  strategy: EntityDeletionStrategy;
  timestamp: number;
  hitCount: number;
  lastAccessed: number;
}

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
export class StrategyCacheService {
  private static instance: StrategyCacheService;
  private cache: LRUCache<string, StrategyCacheEntry>;
  private config: StrategyCacheConfig;
  private stats: CacheStats;
  private warmupPromise: Promise<void> | null = null;

  private constructor(config: StrategyCacheConfig) {
    this.config = config;
    this.stats = {
      hits: 0,
      misses: 0,
      entries: 0,
      hitRate: 0,
      evictions: 0,
      memoryUsage: 0
    };

    this.cache = new LRUCache<string, StrategyCacheEntry>({
      max: config.maxSize,
      ttl: config.ttl * 1000, // Convert to milliseconds
      allowStale: false,
      updateAgeOnGet: true,
      updateAgeOnHas: true,
      dispose: (value: any, key: string) => {
        this.stats.evictions++;
        logger.debug('Strategy cache entry evicted', { key, strategy: value?.strategy?.entityType });
      }
    });

    logger.info('Strategy cache initialized', {
      maxSize: config.maxSize,
      ttl: config.ttl,
      evictionPolicy: config.evictionPolicy,
      warmingEnabled: config.enableWarming
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: StrategyCacheConfig): StrategyCacheService {
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
  public get(entityType: string): EntityDeletionStrategy | null {
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

      logger.debug('Strategy cache hit', {
        entityType,
        strategy: entry.strategy.entityType,
        hitCount: entry.hitCount
      });

      return entry.strategy;
    }

    this.stats.misses++;
    this.updateHitRate();

    logger.debug('Strategy cache miss', { entityType });
    return null;
  }

  /**
   * Put strategy in cache
   */
  public set(entityType: string, strategy: EntityDeletionStrategy): void {
    if (!this.config.enabled) {
      return;
    }

    const cacheKey = this.generateCacheKey(entityType);
    const entry: StrategyCacheEntry = {
      strategy,
      timestamp: Date.now(),
      hitCount: 0,
      lastAccessed: Date.now()
    };

    this.cache.set(cacheKey, entry);
    this.stats.entries = this.cache.size;

    logger.debug('Strategy cached', {
      entityType,
      strategy: strategy.entityType,
      serviceName: strategy.serviceName,
      cacheSize: this.cache.size
    });
  }

  /**
   * Check if strategy is cached
   */
  public has(entityType: string): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const cacheKey = this.generateCacheKey(entityType);
    return this.cache.has(cacheKey);
  }

  /**
   * Remove strategy from cache
   */
  public delete(entityType: string): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const cacheKey = this.generateCacheKey(entityType);
    const deleted = this.cache.delete(cacheKey);
    
    if (deleted) {
      this.stats.entries = this.cache.size;
      logger.debug('Strategy removed from cache', { entityType });
    }

    return deleted;
  }

  /**
   * Clear all cached strategies
   */
  public clear(): void {
    this.cache.clear();
    this.stats.entries = 0;
    logger.info('Strategy cache cleared');
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    return {
      ...this.stats,
      entries: this.cache.size,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Warm up cache with commonly used strategies
   */
  public async warmUp(strategies: Map<string, EntityDeletionStrategy[]>): Promise<void> {
    if (!this.config.enabled || !this.config.enableWarming) {
      return;
    }

    if (this.warmupPromise) {
      return this.warmupPromise;
    }

    this.warmupPromise = this.performWarmup(strategies);
    return this.warmupPromise;
  }

  /**
   * Perform cache warmup
   */
  private async performWarmup(strategies: Map<string, EntityDeletionStrategy[]>): Promise<void> {
    logger.info('Starting strategy cache warmup');

    const warmupStart = Date.now();
    let warmedUpCount = 0;

    for (const [entityType, strategiesArray] of strategies) {
      // Cache the highest priority strategy for each entity type
      if (strategiesArray.length > 0) {
        const highestPriorityStrategy = strategiesArray.reduce((prev, current) => 
          (current.priority > prev.priority) ? current : prev
        );

        this.set(entityType, highestPriorityStrategy);
        warmedUpCount++;
      }
    }

    const warmupTime = Date.now() - warmupStart;
    
    logger.info('Strategy cache warmup completed', {
      strategiesWarmed: warmedUpCount,
      warmupTime,
      cacheSize: this.cache.size
    });

    this.warmupPromise = null;
  }

  /**
   * Preload strategies based on usage patterns
   */
  public async preloadStrategies(entityTypes: string[], strategiesMap: Map<string, EntityDeletionStrategy[]>): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    logger.info('Preloading strategies for entity types', { entityTypes });

    for (const entityType of entityTypes) {
      const strategies = strategiesMap.get(entityType);
      if (strategies && strategies.length > 0) {
        // Cache the highest priority strategy
        const bestStrategy = strategies[0]; // Assuming they're sorted by priority
        this.set(entityType, bestStrategy);
      }
    }
  }

  /**
   * Get cache performance report
   */
  public getPerformanceReport(): {
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
  } {
    const entries = Array.from(this.cache.entries()) as Array<[string, any]>;
    const topStrategies = entries
      .map(([key, entry]: [string, any]) => ({
        entityType: key,
        strategy: entry.strategy.entityType,
        hitCount: entry.hitCount,
        lastAccessed: entry.lastAccessed
      }))
      .sort((a: any, b: any) => b.hitCount - a.hitCount)
      .slice(0, 10);

    const hitRate = this.stats.hitRate;
    const missRate = 100 - hitRate;
    let efficiency = 'Poor';
    
    if (hitRate > 90) efficiency = 'Excellent';
    else if (hitRate > 80) efficiency = 'Good';
    else if (hitRate > 70) efficiency = 'Fair';

    return {
      stats: this.getStats(),
      topStrategies: topStrategies as Array<{
        entityType: string;
        strategy: string;
        hitCount: number;
        lastAccessed: number;
      }>,
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
  public optimizeCache(): void {
    const entries = Array.from(this.cache.entries()) as Array<[string, any]>;
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

    logger.info('Cache optimization completed', {
      removedEntries: removedCount,
      remainingEntries: this.cache.size
    });
  }

  /**
   * Generate cache key for entity type
   */
  private generateCacheKey(entityType: string): string {
    return `strategy:${entityType}`;
  }

  /**
   * Update hit rate statistics
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Estimate memory usage of cache
   */
  private estimateMemoryUsage(): number {
    // Rough estimation of memory usage
    const entries = this.cache.size;
    const avgEntrySize = 1024; // Estimated bytes per entry
    return entries * avgEntrySize;
  }

  /**
   * Get cache configuration
   */
  public getConfig(): StrategyCacheConfig {
    return { ...this.config };
  }

  /**
   * Update cache configuration
   */
  public updateConfig(newConfig: Partial<StrategyCacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Recreate cache with new configuration
    if (newConfig.maxSize || newConfig.ttl) {
      const oldEntries = Array.from(this.cache.entries());
      
      this.cache = new LRUCache<string, StrategyCacheEntry>({
        max: this.config.maxSize,
        ttl: this.config.ttl * 1000,
        allowStale: false,
        updateAgeOnGet: true,
        updateAgeOnHas: true,
        dispose: (value: any, key: string) => {
          this.stats.evictions++;
          logger.debug('Strategy cache entry evicted', { key, strategy: value?.strategy?.entityType });
        }
      });

      // Restore entries
      for (const [key, entry] of oldEntries as Array<[string, any]>) {
        this.cache.set(key, entry);
      }
    }

    logger.info('Cache configuration updated', newConfig);
  }

  /**
   * Get cache metrics for monitoring
   */
  public getMetrics(): Record<string, number> {
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
  public resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      entries: this.cache.size,
      hitRate: 0,
      evictions: 0,
      memoryUsage: 0
    };
    
    logger.info('Cache statistics reset');
  }

  /**
   * Schedule cache cleanup
   */
  public scheduleCleanup(intervalMs: number = 60000): NodeJS.Timeout {
    return setInterval(() => {
      this.optimizeCache();
    }, intervalMs);
  }

  /**
   * Bulk cache operations
   */
  public bulkSet(strategies: Map<string, EntityDeletionStrategy>): void {
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
    
    logger.info('Bulk cache operation completed', {
      strategiesCached: cachedCount,
      bulkTime,
      cacheSize: this.cache.size
    });
  }

  /**
   * Export cache entries for backup
   */
  public exportCache(): Array<{
    entityType: string;
    strategy: EntityDeletionStrategy;
    metadata: {
      timestamp: number;
      hitCount: number;
      lastAccessed: number;
    };
  }> {
    const entries = Array.from(this.cache.entries()) as Array<[string, any]>;
    return entries.map(([key, entry]: [string, any]) => ({
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
  public importCache(entries: Array<{
    entityType: string;
    strategy: EntityDeletionStrategy;
    metadata: {
      timestamp: number;
      hitCount: number;
      lastAccessed: number;
    };
  }>): void {
    if (!this.config.enabled) {
      return;
    }

    let importedCount = 0;
    
    for (const entry of entries) {
      const cacheKey = this.generateCacheKey(entry.entityType);
      const cacheEntry: StrategyCacheEntry = {
        strategy: entry.strategy,
        timestamp: entry.metadata.timestamp,
        hitCount: entry.metadata.hitCount,
        lastAccessed: entry.metadata.lastAccessed
      };
      
      this.cache.set(cacheKey, cacheEntry);
      importedCount++;
    }

    this.stats.entries = this.cache.size;
    
    logger.info('Cache import completed', {
      entriesImported: importedCount,
      cacheSize: this.cache.size
    });
  }
}

// Export singleton instance
export const strategyCacheService = StrategyCacheService.getInstance();