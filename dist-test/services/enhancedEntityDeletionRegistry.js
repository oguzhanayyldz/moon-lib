"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enhancedEntityDeletionRegistry = exports.EnhancedEntityDeletionRegistry = void 0;
const batchProcessingEngine_service_1 = require("./batchProcessingEngine.service");
const strategyCache_service_1 = require("./strategyCache.service");
const performanceMonitor_util_1 = require("../utils/performanceMonitor.util");
const logger_service_1 = require("./logger.service");
/**
 * Enhanced Entity Deletion Registry with batch operations and performance optimizations
 */
class EnhancedEntityDeletionRegistry {
    constructor() {
        this.strategies = new Map();
        this.batchStrategies = new Map();
        this.cacheWarmedUp = false;
        // Try to import transaction manager if available
        try {
            const { transactionManager } = require('../database/index');
            this.transactionManager = transactionManager;
        }
        catch (error) {
            logger_service_1.logger.debug('Transaction manager not available, will use non-transaction mode');
            this.transactionManager = null;
        }
        // Initialize batch processing engine
        this.batchProcessingEngine = new batchProcessingEngine_service_1.BatchProcessingEngine(batchProcessingEngine_service_1.DEFAULT_BATCH_CONFIG);
        // Initialize performance monitoring
        performanceMonitor_util_1.performanceMonitor.startMonitoring();
        logger_service_1.logger.info('Enhanced Entity Deletion Registry initialized', {
            cacheEnabled: strategyCache_service_1.strategyCacheService.getConfig().enabled,
            batchProcessingEnabled: true,
            performanceMonitoringEnabled: true
        });
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!EnhancedEntityDeletionRegistry.instance) {
            EnhancedEntityDeletionRegistry.instance = new EnhancedEntityDeletionRegistry();
        }
        return EnhancedEntityDeletionRegistry.instance;
    }
    /**
     * Register a deletion strategy
     */
    register(strategy) {
        const entityType = strategy.entityType;
        // Register in regular strategies map
        if (!this.strategies.has(entityType)) {
            this.strategies.set(entityType, []);
        }
        const strategies = this.strategies.get(entityType);
        // Check if strategy with same service name already exists
        const existingIndex = strategies.findIndex(s => s.serviceName === strategy.serviceName);
        if (existingIndex >= 0) {
            strategies[existingIndex] = strategy;
            logger_service_1.logger.info(`Replaced existing deletion strategy for ${entityType}`, {
                entityType,
                serviceName: strategy.serviceName,
                strategyName: strategy.constructor.name
            });
        }
        else {
            strategies.push(strategy);
            logger_service_1.logger.info(`Registered new deletion strategy for ${entityType}`, {
                entityType,
                serviceName: strategy.serviceName,
                strategyName: strategy.constructor.name,
                priority: strategy.priority
            });
        }
        // Sort strategies by priority (highest first)
        strategies.sort((a, b) => b.priority - a.priority);
        // Cache the highest priority strategy
        strategyCache_service_1.strategyCacheService.set(entityType, strategies[0]);
        // Register as batch strategy if it supports batch operations
        if (this.isBatchStrategy(strategy)) {
            this.registerBatchStrategy(strategy);
        }
        // Update performance metrics
        performanceMonitor_util_1.performanceMonitor.incrementMetric('strategies_registered');
    }
    /**
     * Register a batch deletion strategy
     */
    registerBatchStrategy(strategy) {
        const entityType = strategy.entityType;
        if (!this.batchStrategies.has(entityType)) {
            this.batchStrategies.set(entityType, []);
        }
        const batchStrategies = this.batchStrategies.get(entityType);
        const existingIndex = batchStrategies.findIndex(s => s.serviceName === strategy.serviceName);
        if (existingIndex >= 0) {
            batchStrategies[existingIndex] = strategy;
        }
        else {
            batchStrategies.push(strategy);
        }
        batchStrategies.sort((a, b) => b.priority - a.priority);
        logger_service_1.logger.info(`Registered batch deletion strategy for ${entityType}`, {
            entityType,
            serviceName: strategy.serviceName,
            maxBatchSize: strategy.maxBatchSize,
            supportsBatch: strategy.supportsBatch
        });
    }
    /**
     * Unregister a deletion strategy
     */
    unregister(entityType, serviceName) {
        const strategies = this.strategies.get(entityType);
        if (!strategies) {
            logger_service_1.logger.warn(`No strategies found for entity type: ${entityType}`);
            return;
        }
        if (serviceName) {
            // Remove specific service strategy
            const filteredStrategies = strategies.filter(s => s.serviceName !== serviceName);
            if (filteredStrategies.length !== strategies.length) {
                this.strategies.set(entityType, filteredStrategies);
                // Update cache
                if (filteredStrategies.length > 0) {
                    strategyCache_service_1.strategyCacheService.set(entityType, filteredStrategies[0]);
                }
                else {
                    strategyCache_service_1.strategyCacheService.delete(entityType);
                }
                // Remove from batch strategies
                const batchStrategies = this.batchStrategies.get(entityType);
                if (batchStrategies) {
                    const filteredBatchStrategies = batchStrategies.filter(s => s.serviceName !== serviceName);
                    this.batchStrategies.set(entityType, filteredBatchStrategies);
                }
                logger_service_1.logger.info(`Unregistered deletion strategy for ${entityType}`, {
                    entityType,
                    serviceName
                });
            }
        }
        else {
            // Remove all strategies for the entity type
            this.strategies.delete(entityType);
            this.batchStrategies.delete(entityType);
            strategyCache_service_1.strategyCacheService.delete(entityType);
            logger_service_1.logger.info(`Unregistered all deletion strategies for ${entityType}`, {
                entityType
            });
        }
        performanceMonitor_util_1.performanceMonitor.incrementMetric('strategies_unregistered');
    }
    /**
     * Resolve strategy with caching
     */
    resolve(entityType) {
        // Try cache first
        const cachedStrategy = strategyCache_service_1.strategyCacheService.get(entityType);
        if (cachedStrategy) {
            performanceMonitor_util_1.performanceMonitor.incrementMetric('cache_hits');
            return cachedStrategy;
        }
        performanceMonitor_util_1.performanceMonitor.incrementMetric('cache_misses');
        // Fallback to direct resolution
        const strategies = this.strategies.get(entityType);
        if (!strategies || strategies.length === 0) {
            logger_service_1.logger.warn(`No deletion strategy found for entity type: ${entityType}`);
            return null;
        }
        const selectedStrategy = strategies[0];
        // Cache the resolved strategy
        strategyCache_service_1.strategyCacheService.set(entityType, selectedStrategy);
        logger_service_1.logger.debug(`Resolved deletion strategy for ${entityType}`, {
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
    resolveBatchStrategy(entityType) {
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
    async execute(context) {
        const timer = new performanceMonitor_util_1.PerformanceTimer(`single_deletion_${context.entityType}_${context.entityId}`);
        try {
            // Warm up cache if not already done
            await this.ensureCacheWarmedUp();
            // Apply default configuration
            const configWithDefaults = Object.assign({ useTransactions: false, transactionTimeout: 30000, retryOnTransactionError: true, maxRetries: 3, enableDetailedLogging: false }, context.config);
            const enhancedContext = Object.assign(Object.assign({}, context), { config: configWithDefaults });
            performanceMonitor_util_1.performanceMonitor.incrementMetric('single_deletions_attempted');
            let result;
            if (configWithDefaults.useTransactions && this.transactionManager) {
                result = await this.executeWithTransaction(enhancedContext);
            }
            else {
                result = await this.executeWithoutTransaction(enhancedContext);
            }
            const executionTime = timer.stop();
            // Record metrics
            if (result.success) {
                performanceMonitor_util_1.performanceMonitor.incrementMetric('single_deletions_successful');
            }
            else {
                performanceMonitor_util_1.performanceMonitor.incrementMetric('single_deletions_failed');
            }
            performanceMonitor_util_1.performanceMonitor.setMetric('last_single_deletion_time', executionTime);
            return result;
        }
        catch (error) {
            timer.stop();
            performanceMonitor_util_1.performanceMonitor.incrementMetric('single_deletions_error');
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_service_1.logger.error('Single entity deletion failed', {
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
    async executeBatch(context) {
        const timer = new performanceMonitor_util_1.PerformanceTimer(`batch_deletion_${context.requestId || Date.now()}`);
        try {
            // Warm up cache if not already done
            await this.ensureCacheWarmedUp();
            // Apply default batch configuration
            const configWithDefaults = Object.assign({ useTransactions: false, transactionTimeout: 30000, retryOnTransactionError: true, maxRetries: 3, enableDetailedLogging: false, batchSize: 50, maxConcurrentBatches: 3, batchTimeout: 60000, continueOnBatchFailure: true, useBulkOperations: true, memoryThreshold: 512, enablePerformanceMonitoring: true, enableConnectionPooling: true, batchDelay: 100 }, context.config);
            const enhancedContext = Object.assign(Object.assign({}, context), { config: configWithDefaults });
            performanceMonitor_util_1.performanceMonitor.incrementMetric('batch_deletions_attempted');
            performanceMonitor_util_1.performanceMonitor.setMetric('active_batches', performanceMonitor_util_1.performanceMonitor.getMetric('active_batches', 0) + 1);
            const result = await this.batchProcessingEngine.processBatchDeletion(enhancedContext);
            const executionTime = timer.stop();
            // Record metrics
            if (result.success) {
                performanceMonitor_util_1.performanceMonitor.incrementMetric('batch_deletions_successful');
            }
            else {
                performanceMonitor_util_1.performanceMonitor.incrementMetric('batch_deletions_failed');
            }
            performanceMonitor_util_1.performanceMonitor.setMetric('last_batch_deletion_time', executionTime);
            performanceMonitor_util_1.performanceMonitor.decrementMetric('active_batches');
            return result;
        }
        catch (error) {
            timer.stop();
            performanceMonitor_util_1.performanceMonitor.incrementMetric('batch_deletions_error');
            performanceMonitor_util_1.performanceMonitor.decrementMetric('active_batches');
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_service_1.logger.error('Batch deletion failed', {
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
                    peakMemoryUsage: performanceMonitor_util_1.performanceMonitor.getCurrentResourceUsage().memoryUsage,
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
    async executeWithTransaction(context) {
        if (!this.transactionManager) {
            logger_service_1.logger.warn('Transaction requested but transaction manager not available, falling back to non-transaction mode');
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
        logger_service_1.logger.info(`Executing entity deletion with transaction`, {
            entityType: context.entityType,
            entityId: context.entityId,
            serviceName: strategy.serviceName,
            strategy: strategy.constructor.name
        });
        try {
            return await this.transactionManager.executeTransaction(`entity_deletion_${context.entityType}_${Date.now()}`, [
                {
                    id: 'validate_deletion',
                    execute: async (session) => {
                        const validation = await strategy.validate(Object.assign(Object.assign({}, context), { transaction: session }));
                        if (!validation.isValid) {
                            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
                        }
                        return validation;
                    }
                },
                {
                    id: 'execute_deletion',
                    isResultOperation: true,
                    execute: async (session) => {
                        return await strategy.execute(Object.assign(Object.assign({}, context), { transaction: session }));
                    }
                }
            ]);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
            logger_service_1.logger.error('Entity deletion transaction failed', {
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
    async executeWithoutTransaction(context) {
        const strategy = this.resolve(context.entityType);
        if (!strategy) {
            return {
                success: false,
                deletedEntities: [],
                affectedServices: [],
                error: `No deletion strategy found for entity type: ${context.entityType}`
            };
        }
        logger_service_1.logger.info(`Executing entity deletion without transaction`, {
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
            logger_service_1.logger.info(`Entity deletion completed`, {
                entityType: context.entityType,
                entityId: context.entityId,
                success: result.success,
                deletedEntities: result.deletedEntities,
                affectedServices: result.affectedServices
            });
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Deletion failed';
            logger_service_1.logger.error('Entity deletion failed', {
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
    getAllStrategies() {
        return new Map(this.strategies);
    }
    /**
     * Get all batch strategies
     */
    getAllBatchStrategies() {
        return new Map(this.batchStrategies);
    }
    /**
     * Check if a strategy is registered
     */
    hasStrategy(entityType) {
        const strategies = this.strategies.get(entityType);
        return Boolean(strategies && strategies.length > 0);
    }
    /**
     * Check if a batch strategy is registered
     */
    hasBatchStrategy(entityType) {
        const batchStrategies = this.batchStrategies.get(entityType);
        return Boolean(batchStrategies && batchStrategies.length > 0);
    }
    /**
     * Get comprehensive statistics
     */
    getStats() {
        const allStrategies = Array.from(this.strategies.values()).flat();
        const allBatchStrategies = Array.from(this.batchStrategies.values()).flat();
        const servicesInvolved = [...new Set(allStrategies.map(s => s.serviceName))];
        return {
            totalStrategies: allStrategies.length,
            batchStrategies: allBatchStrategies.length,
            entitiesSupported: Array.from(this.strategies.keys()),
            servicesInvolved,
            cacheStats: strategyCache_service_1.strategyCacheService.getStats(),
            performanceStats: performanceMonitor_util_1.performanceMonitor.getAggregatedMetrics(),
            batchEngineStats: this.batchProcessingEngine.getStats()
        };
    }
    /**
     * Clear all registered strategies
     */
    clear() {
        this.strategies.clear();
        this.batchStrategies.clear();
        strategyCache_service_1.strategyCacheService.clear();
        performanceMonitor_util_1.performanceMonitor.clearMetrics();
        this.cacheWarmedUp = false;
        logger_service_1.logger.info('Cleared all registered deletion strategies and caches');
    }
    /**
     * Check if transaction manager is available
     */
    isTransactionManagerAvailable() {
        return Boolean(this.transactionManager);
    }
    /**
     * Warm up the strategy cache
     */
    async warmUpCache() {
        if (this.cacheWarmedUp) {
            return;
        }
        logger_service_1.logger.info('Warming up strategy cache');
        await strategyCache_service_1.strategyCacheService.warmUp(this.strategies);
        this.cacheWarmedUp = true;
        performanceMonitor_util_1.performanceMonitor.setMetric('cache_warmed_up', 1);
        logger_service_1.logger.info('Strategy cache warm-up completed');
    }
    /**
     * Ensure cache is warmed up
     */
    async ensureCacheWarmedUp() {
        if (!this.cacheWarmedUp) {
            await this.warmUpCache();
        }
    }
    /**
     * Check if strategy supports batch operations
     */
    isBatchStrategy(strategy) {
        return !!(strategy.supportsBatch &&
            strategy.maxBatchSize &&
            typeof strategy.processBatch === 'function');
    }
    /**
     * Optimize performance
     */
    async optimizePerformance() {
        logger_service_1.logger.info('Starting performance optimization');
        // Optimize cache
        strategyCache_service_1.strategyCacheService.optimizeCache();
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
            logger_service_1.logger.debug('Forced garbage collection');
        }
        // Update performance metrics
        performanceMonitor_util_1.performanceMonitor.setMetric('last_optimization', Date.now());
        logger_service_1.logger.info('Performance optimization completed');
    }
    /**
     * Get performance report
     */
    getPerformanceReport() {
        return {
            registry: this.getStats(),
            cache: strategyCache_service_1.strategyCacheService.getPerformanceReport(),
            batchEngine: this.batchProcessingEngine.getStats(),
            resourceUsage: performanceMonitor_util_1.performanceMonitor.getCurrentResourceUsage()
        };
    }
    /**
     * Shutdown the registry and cleanup resources
     */
    async shutdown() {
        logger_service_1.logger.info('Shutting down Enhanced Entity Deletion Registry');
        // Stop monitoring
        performanceMonitor_util_1.performanceMonitor.stopMonitoring();
        // Shutdown batch processing engine
        await this.batchProcessingEngine.shutdown();
        // Clear all data
        this.clear();
        logger_service_1.logger.info('Enhanced Entity Deletion Registry shutdown completed');
    }
}
exports.EnhancedEntityDeletionRegistry = EnhancedEntityDeletionRegistry;
// Export singleton instance - conditional initialization for test environment
exports.enhancedEntityDeletionRegistry = (() => {
    // In test environment, delay singleton creation to allow mocks to be set up
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
        return null; // Will be initialized lazily when actually needed
    }
    return EnhancedEntityDeletionRegistry.getInstance();
})();
//# sourceMappingURL=enhancedEntityDeletionRegistry.js.map