import { 
  EntityDeletionStrategy, 
  IEntityDeletionRegistry,
  DeletionContext, 
  DeletionResult,
  BatchDeletionStrategy
} from '../common/interfaces/entity-deletion.interface';
import { 
  BatchDeletionContext, 
  BatchDeletionResult, 
  BatchDeletionConfig
} from '../common/interfaces/batch-deletion.interface';
import { BatchProcessingEngine, DEFAULT_BATCH_CONFIG } from './batchProcessingEngine.service';
import { strategyCacheService } from './strategyCache.service';
import { performanceMonitor, PerformanceTimer } from '../utils/performanceMonitor.util';
import { logger } from './logger.service';

/**
 * Enhanced Entity Deletion Registry with batch operations and performance optimizations
 */
export class EnhancedEntityDeletionRegistry implements IEntityDeletionRegistry {
  private static instance: EnhancedEntityDeletionRegistry;
  private strategies = new Map<string, EntityDeletionStrategy[]>();
  private batchStrategies = new Map<string, BatchDeletionStrategy[]>();
  private transactionManager: any;
  private batchProcessingEngine: BatchProcessingEngine;
  private cacheWarmedUp = false;

  private constructor() {
    // Try to import transaction manager if available
    try {
      const { transactionManager } = require('../database/index');
      this.transactionManager = transactionManager;
    } catch (error) {
      logger.debug('Transaction manager not available, will use non-transaction mode');
      this.transactionManager = null;
    }

    // Initialize batch processing engine
    this.batchProcessingEngine = new BatchProcessingEngine(DEFAULT_BATCH_CONFIG);

    // Initialize performance monitoring
    performanceMonitor.startMonitoring();
    
    logger.info('Enhanced Entity Deletion Registry initialized', {
      cacheEnabled: strategyCacheService.getConfig().enabled,
      batchProcessingEnabled: true,
      performanceMonitoringEnabled: true
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): EnhancedEntityDeletionRegistry {
    if (!EnhancedEntityDeletionRegistry.instance) {
      EnhancedEntityDeletionRegistry.instance = new EnhancedEntityDeletionRegistry();
    }
    return EnhancedEntityDeletionRegistry.instance;
  }

  /**
   * Register a deletion strategy
   */
  public register(strategy: EntityDeletionStrategy): void {
    const entityType = strategy.entityType;
    
    // Register in regular strategies map
    if (!this.strategies.has(entityType)) {
      this.strategies.set(entityType, []);
    }

    const strategies = this.strategies.get(entityType)!;
    
    // Check if strategy with same service name already exists
    const existingIndex = strategies.findIndex(
      s => s.serviceName === strategy.serviceName
    );

    if (existingIndex >= 0) {
      strategies[existingIndex] = strategy;
      logger.info(`Replaced existing deletion strategy for ${entityType}`, {
        entityType,
        serviceName: strategy.serviceName,
        strategyName: strategy.constructor.name
      });
    } else {
      strategies.push(strategy);
      logger.info(`Registered new deletion strategy for ${entityType}`, {
        entityType,
        serviceName: strategy.serviceName,
        strategyName: strategy.constructor.name,
        priority: strategy.priority
      });
    }

    // Sort strategies by priority (highest first)
    strategies.sort((a, b) => b.priority - a.priority);

    // Cache the highest priority strategy
    strategyCacheService.set(entityType, strategies[0]);

    // Register as batch strategy if it supports batch operations
    if (this.isBatchStrategy(strategy)) {
      this.registerBatchStrategy(strategy);
    }

    // Update performance metrics
    performanceMonitor.incrementMetric('strategies_registered');
  }

  /**
   * Register a batch deletion strategy
   */
  public registerBatchStrategy(strategy: BatchDeletionStrategy): void {
    const entityType = strategy.entityType;
    
    if (!this.batchStrategies.has(entityType)) {
      this.batchStrategies.set(entityType, []);
    }

    const batchStrategies = this.batchStrategies.get(entityType)!;
    
    const existingIndex = batchStrategies.findIndex(
      s => s.serviceName === strategy.serviceName
    );

    if (existingIndex >= 0) {
      batchStrategies[existingIndex] = strategy;
    } else {
      batchStrategies.push(strategy);
    }

    batchStrategies.sort((a, b) => b.priority - a.priority);

    logger.info(`Registered batch deletion strategy for ${entityType}`, {
      entityType,
      serviceName: strategy.serviceName,
      maxBatchSize: strategy.maxBatchSize,
      supportsBatch: strategy.supportsBatch
    });
  }

  /**
   * Unregister a deletion strategy
   */
  public unregister(entityType: string, serviceName?: string): void {
    const strategies = this.strategies.get(entityType);
    
    if (!strategies) {
      logger.warn(`No strategies found for entity type: ${entityType}`);
      return;
    }

    if (serviceName) {
      // Remove specific service strategy
      const filteredStrategies = strategies.filter(s => s.serviceName !== serviceName);
      
      if (filteredStrategies.length !== strategies.length) {
        this.strategies.set(entityType, filteredStrategies);
        
        // Update cache
        if (filteredStrategies.length > 0) {
          strategyCacheService.set(entityType, filteredStrategies[0]);
        } else {
          strategyCacheService.delete(entityType);
        }
        
        // Remove from batch strategies
        const batchStrategies = this.batchStrategies.get(entityType);
        if (batchStrategies) {
          const filteredBatchStrategies = batchStrategies.filter(s => s.serviceName !== serviceName);
          this.batchStrategies.set(entityType, filteredBatchStrategies);
        }
        
        logger.info(`Unregistered deletion strategy for ${entityType}`, {
          entityType,
          serviceName
        });
      }
    } else {
      // Remove all strategies for the entity type
      this.strategies.delete(entityType);
      this.batchStrategies.delete(entityType);
      strategyCacheService.delete(entityType);
      
      logger.info(`Unregistered all deletion strategies for ${entityType}`, {
        entityType
      });
    }

    performanceMonitor.incrementMetric('strategies_unregistered');
  }

  /**
   * Resolve strategy with caching
   */
  public resolve(entityType: string): EntityDeletionStrategy | null {
    // Try cache first
    const cachedStrategy = strategyCacheService.get(entityType);
    if (cachedStrategy) {
      performanceMonitor.incrementMetric('cache_hits');
      return cachedStrategy;
    }

    performanceMonitor.incrementMetric('cache_misses');

    // Fallback to direct resolution
    const strategies = this.strategies.get(entityType);
    
    if (!strategies || strategies.length === 0) {
      logger.warn(`No deletion strategy found for entity type: ${entityType}`);
      return null;
    }

    const selectedStrategy = strategies[0];
    
    // Cache the resolved strategy
    strategyCacheService.set(entityType, selectedStrategy);
    
    logger.debug(`Resolved deletion strategy for ${entityType}`, {
      entityType,
      serviceName: selectedStrategy.serviceName,
      strategyName: selectedStrategy.constructor.name,
      priority: selectedStrategy.priority
    });

    return selectedStrategy;
  }

  /**
   * Resolve batch strategy
   */
  public resolveBatchStrategy(entityType: string): BatchDeletionStrategy | null {
    const batchStrategies = this.batchStrategies.get(entityType);
    
    if (!batchStrategies || batchStrategies.length === 0) {
      // Fallback to regular strategy if it supports batch
      const regularStrategy = this.resolve(entityType);
      if (regularStrategy && this.isBatchStrategy(regularStrategy)) {
        return regularStrategy;
      }
      return null;
    }

    return batchStrategies[0];
  }

  /**
   * Execute single entity deletion
   */
  public async execute(context: DeletionContext): Promise<DeletionResult> {
    const timer = new PerformanceTimer(`single_deletion_${context.entityType}_${context.entityId}`);
    
    try {
      // Warm up cache if not already done
      await this.ensureCacheWarmedUp();

      // Apply default configuration
      const configWithDefaults = {
        useTransactions: false,
        transactionTimeout: 30000,
        retryOnTransactionError: true,
        maxRetries: 3,
        enableDetailedLogging: false,
        ...context.config
      };

      const enhancedContext = {
        ...context,
        config: configWithDefaults
      };

      performanceMonitor.incrementMetric('single_deletions_attempted');

      let result: DeletionResult;
      if (configWithDefaults.useTransactions && this.transactionManager) {
        result = await this.executeWithTransaction(enhancedContext);
      } else {
        result = await this.executeWithoutTransaction(enhancedContext);
      }

      const executionTime = timer.stop();
      
      // Record metrics
      if (result.success) {
        performanceMonitor.incrementMetric('single_deletions_successful');
      } else {
        performanceMonitor.incrementMetric('single_deletions_failed');
      }

      performanceMonitor.setMetric('last_single_deletion_time', executionTime);

      return result;

    } catch (error) {
      timer.stop();
      performanceMonitor.incrementMetric('single_deletions_error');
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Single entity deletion failed', {
        entityType: context.entityType,
        entityId: context.entityId,
        error: errorMessage
      });

      return {
        success: false,
        deletedEntities: [],
        affectedServices: [],
        error: errorMessage
      };
    }
  }

  /**
   * Execute batch deletion
   */
  public async executeBatch(context: BatchDeletionContext): Promise<BatchDeletionResult> {
    const timer = new PerformanceTimer(`batch_deletion_${context.requestId || Date.now()}`);
    
    try {
      // Warm up cache if not already done
      await this.ensureCacheWarmedUp();

      // Apply default batch configuration
      const configWithDefaults: BatchDeletionConfig = {
        useTransactions: false,
        transactionTimeout: 30000,
        retryOnTransactionError: true,
        maxRetries: 3,
        enableDetailedLogging: false,
        batchSize: 50,
        maxConcurrentBatches: 3,
        batchTimeout: 60000,
        continueOnBatchFailure: true,
        useBulkOperations: true,
        memoryThreshold: 512,
        enablePerformanceMonitoring: true,
        enableConnectionPooling: true,
        batchDelay: 100,
        ...context.config
      };

      const enhancedContext = {
        ...context,
        config: configWithDefaults
      };

      performanceMonitor.incrementMetric('batch_deletions_attempted');
      performanceMonitor.setMetric('active_batches', 
        performanceMonitor.getMetric('active_batches', 0) + 1
      );

      const result = await this.batchProcessingEngine.processBatchDeletion(enhancedContext);
      
      const executionTime = timer.stop();

      // Record metrics
      if (result.success) {
        performanceMonitor.incrementMetric('batch_deletions_successful');
      } else {
        performanceMonitor.incrementMetric('batch_deletions_failed');
      }

      performanceMonitor.setMetric('last_batch_deletion_time', executionTime);
      performanceMonitor.decrementMetric('active_batches');

      return result;

    } catch (error) {
      timer.stop();
      performanceMonitor.incrementMetric('batch_deletions_error');
      performanceMonitor.decrementMetric('active_batches');
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Batch deletion failed', {
        requestId: context.requestId,
        itemCount: context.items.length,
        error: errorMessage
      });

      return {
        success: false,
        batchResults: [],
        metrics: {
          totalItems: context.items.length,
          successfulDeletions: 0,
          failedDeletions: context.items.length,
          totalExecutionTime: timer.getElapsed(),
          averageTimePerItem: 0,
          batchesProcessed: 0,
          parallelOperations: 0,
          peakMemoryUsage: performanceMonitor.getCurrentResourceUsage().memoryUsage,
          databaseOperations: 0,
          networkOperations: 0,
          retriesPerformed: 0
        },
        affectedServices: [],
        error: errorMessage
      };
    }
  }

  /**
   * Execute with transaction support
   */
  public async executeWithTransaction(context: DeletionContext): Promise<DeletionResult> {
    if (!this.transactionManager) {
      logger.warn('Transaction requested but transaction manager not available, falling back to non-transaction mode');
      return await this.executeWithoutTransaction(context);
    }

    const strategy = this.resolve(context.entityType);
    
    if (!strategy) {
      return {
        success: false,
        deletedEntities: [],
        affectedServices: [],
        error: `No deletion strategy found for entity type: ${context.entityType}`
      };
    }

    logger.info(`Executing entity deletion with transaction`, {
      entityType: context.entityType,
      entityId: context.entityId,
      serviceName: strategy.serviceName,
      strategy: strategy.constructor.name
    });

    try {
      return await this.transactionManager.executeTransaction(
        `entity_deletion_${context.entityType}_${Date.now()}`,
        [
          {
            id: 'validate_deletion',
            execute: async (session: any) => {
              const validation = await strategy.validate({
                ...context,
                transaction: session
              });
              
              if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
              }
              
              return validation;
            }
          },
          {
            id: 'execute_deletion',
            isResultOperation: true,
            execute: async (session: any) => {
              return await strategy.execute({
                ...context,
                transaction: session
              });
            }
          }
        ]
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
      
      logger.error('Entity deletion transaction failed', {
        entityType: context.entityType,
        entityId: context.entityId,
        error: errorMessage
      });

      return {
        success: false,
        deletedEntities: [],
        affectedServices: [strategy.serviceName],
        error: `Transaction failed: ${errorMessage}`
      };
    }
  }

  /**
   * Execute without transaction
   */
  public async executeWithoutTransaction(context: DeletionContext): Promise<DeletionResult> {
    const strategy = this.resolve(context.entityType);
    
    if (!strategy) {
      return {
        success: false,
        deletedEntities: [],
        affectedServices: [],
        error: `No deletion strategy found for entity type: ${context.entityType}`
      };
    }

    logger.info(`Executing entity deletion without transaction`, {
      entityType: context.entityType,
      entityId: context.entityId,
      serviceName: strategy.serviceName,
      strategy: strategy.constructor.name
    });

    try {
      // Validate before execution
      const validation = await strategy.validate(context);
      
      if (!validation.isValid) {
        return {
          success: false,
          deletedEntities: [],
          affectedServices: [strategy.serviceName],
          error: `Validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Execute deletion
      const result = await strategy.execute(context);
      
      logger.info(`Entity deletion completed`, {
        entityType: context.entityType,
        entityId: context.entityId,
        success: result.success,
        deletedEntities: result.deletedEntities,
        affectedServices: result.affectedServices
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Deletion failed';
      
      logger.error('Entity deletion failed', {
        entityType: context.entityType,
        entityId: context.entityId,
        serviceName: strategy.serviceName,
        error: errorMessage
      });

      return {
        success: false,
        deletedEntities: [],
        affectedServices: [strategy.serviceName],
        error: errorMessage
      };
    }
  }

  /**
   * Get all registered strategies
   */
  public getAllStrategies(): Map<string, EntityDeletionStrategy[]> {
    return new Map(this.strategies);
  }

  /**
   * Get all batch strategies
   */
  public getAllBatchStrategies(): Map<string, BatchDeletionStrategy[]> {
    return new Map(this.batchStrategies);
  }

  /**
   * Check if a strategy is registered
   */
  public hasStrategy(entityType: string): boolean {
    const strategies = this.strategies.get(entityType);
    return Boolean(strategies && strategies.length > 0);
  }

  /**
   * Check if a batch strategy is registered
   */
  public hasBatchStrategy(entityType: string): boolean {
    const batchStrategies = this.batchStrategies.get(entityType);
    return Boolean(batchStrategies && batchStrategies.length > 0);
  }

  /**
   * Get comprehensive statistics
   */
  public getStats(): {
    totalStrategies: number;
    batchStrategies: number;
    entitiesSupported: string[];
    servicesInvolved: string[];
    cacheStats: any;
    performanceStats: any;
    batchEngineStats: any;
  } {
    const allStrategies = Array.from(this.strategies.values()).flat();
    const allBatchStrategies = Array.from(this.batchStrategies.values()).flat();
    const servicesInvolved = [...new Set(allStrategies.map(s => s.serviceName))];
    
    return {
      totalStrategies: allStrategies.length,
      batchStrategies: allBatchStrategies.length,
      entitiesSupported: Array.from(this.strategies.keys()),
      servicesInvolved,
      cacheStats: strategyCacheService.getStats(),
      performanceStats: performanceMonitor.getAggregatedMetrics(),
      batchEngineStats: this.batchProcessingEngine.getStats()
    };
  }

  /**
   * Clear all registered strategies
   */
  public clear(): void {
    this.strategies.clear();
    this.batchStrategies.clear();
    strategyCacheService.clear();
    performanceMonitor.clearMetrics();
    this.cacheWarmedUp = false;
    
    logger.info('Cleared all registered deletion strategies and caches');
  }

  /**
   * Check if transaction manager is available
   */
  public isTransactionManagerAvailable(): boolean {
    return Boolean(this.transactionManager);
  }

  /**
   * Warm up the strategy cache
   */
  public async warmUpCache(): Promise<void> {
    if (this.cacheWarmedUp) {
      return;
    }

    logger.info('Warming up strategy cache');
    await strategyCacheService.warmUp(this.strategies);
    this.cacheWarmedUp = true;
    
    performanceMonitor.setMetric('cache_warmed_up', 1);
    logger.info('Strategy cache warm-up completed');
  }

  /**
   * Ensure cache is warmed up
   */
  private async ensureCacheWarmedUp(): Promise<void> {
    if (!this.cacheWarmedUp) {
      await this.warmUpCache();
    }
  }

  /**
   * Check if strategy supports batch operations
   */
  private isBatchStrategy(strategy: EntityDeletionStrategy): strategy is BatchDeletionStrategy {
    return !!(strategy.supportsBatch && 
              strategy.maxBatchSize && 
              typeof (strategy as any).processBatch === 'function');
  }

  /**
   * Optimize performance
   */
  public async optimizePerformance(): Promise<void> {
    logger.info('Starting performance optimization');

    // Optimize cache
    strategyCacheService.optimizeCache();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      logger.debug('Forced garbage collection');
    }

    // Update performance metrics
    performanceMonitor.setMetric('last_optimization', Date.now());
    
    logger.info('Performance optimization completed');
  }

  /**
   * Get performance report
   */
  public getPerformanceReport(): {
    registry: any;
    cache: any;
    batchEngine: any;
    resourceUsage: any;
  } {
    return {
      registry: this.getStats(),
      cache: strategyCacheService.getPerformanceReport(),
      batchEngine: this.batchProcessingEngine.getStats(),
      resourceUsage: performanceMonitor.getCurrentResourceUsage()
    };
  }

  /**
   * Shutdown the registry and cleanup resources
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down Enhanced Entity Deletion Registry');
    
    // Stop monitoring
    performanceMonitor.stopMonitoring();
    
    // Shutdown batch processing engine
    await this.batchProcessingEngine.shutdown();
    
    // Clear all data
    this.clear();
    
    logger.info('Enhanced Entity Deletion Registry shutdown completed');
  }
}

// Export singleton instance - conditional initialization for test environment
export const enhancedEntityDeletionRegistry = (() => {
  // In test environment, delay singleton creation to allow mocks to be set up
  if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
    return null as any; // Will be initialized lazily when actually needed
  }
  return EnhancedEntityDeletionRegistry.getInstance();
})();