import { EntityDeletionStrategy, IEntityDeletionRegistry, DeletionContext, DeletionResult, BatchDeletionStrategy } from '../common/interfaces/entity-deletion.interface';
import { BatchDeletionContext, BatchDeletionResult } from '../common/interfaces/batch-deletion.interface';
/**
 * Enhanced Entity Deletion Registry with batch operations and performance optimizations
 */
export declare class EnhancedEntityDeletionRegistry implements IEntityDeletionRegistry {
    private static instance;
    private strategies;
    private batchStrategies;
    private transactionManager;
    private batchProcessingEngine;
    private cacheWarmedUp;
    private constructor();
    /**
     * Get singleton instance
     */
    static getInstance(): EnhancedEntityDeletionRegistry;
    /**
     * Register a deletion strategy
     */
    register(strategy: EntityDeletionStrategy): void;
    /**
     * Register a batch deletion strategy
     */
    registerBatchStrategy(strategy: BatchDeletionStrategy): void;
    /**
     * Unregister a deletion strategy
     */
    unregister(entityType: string, serviceName?: string): void;
    /**
     * Resolve strategy with caching
     */
    resolve(entityType: string): EntityDeletionStrategy | null;
    /**
     * Resolve batch strategy
     */
    resolveBatchStrategy(entityType: string): BatchDeletionStrategy | null;
    /**
     * Execute single entity deletion
     */
    execute(context: DeletionContext): Promise<DeletionResult>;
    /**
     * Execute batch deletion
     */
    executeBatch(context: BatchDeletionContext): Promise<BatchDeletionResult>;
    /**
     * Execute with transaction support
     */
    executeWithTransaction(context: DeletionContext): Promise<DeletionResult>;
    /**
     * Execute without transaction
     */
    executeWithoutTransaction(context: DeletionContext): Promise<DeletionResult>;
    /**
     * Get all registered strategies
     */
    getAllStrategies(): Map<string, EntityDeletionStrategy[]>;
    /**
     * Get all batch strategies
     */
    getAllBatchStrategies(): Map<string, BatchDeletionStrategy[]>;
    /**
     * Check if a strategy is registered
     */
    hasStrategy(entityType: string): boolean;
    /**
     * Check if a batch strategy is registered
     */
    hasBatchStrategy(entityType: string): boolean;
    /**
     * Get comprehensive statistics
     */
    getStats(): {
        totalStrategies: number;
        batchStrategies: number;
        entitiesSupported: string[];
        servicesInvolved: string[];
        cacheStats: any;
        performanceStats: any;
        batchEngineStats: any;
    };
    /**
     * Clear all registered strategies
     */
    clear(): void;
    /**
     * Check if transaction manager is available
     */
    isTransactionManagerAvailable(): boolean;
    /**
     * Warm up the strategy cache
     */
    warmUpCache(): Promise<void>;
    /**
     * Ensure cache is warmed up
     */
    private ensureCacheWarmedUp;
    /**
     * Check if strategy supports batch operations
     */
    private isBatchStrategy;
    /**
     * Optimize performance
     */
    optimizePerformance(): Promise<void>;
    /**
     * Get performance report
     */
    getPerformanceReport(): {
        registry: any;
        cache: any;
        batchEngine: any;
        resourceUsage: any;
    };
    /**
     * Shutdown the registry and cleanup resources
     */
    shutdown(): Promise<void>;
}
export declare const enhancedEntityDeletionRegistry: EnhancedEntityDeletionRegistry;
