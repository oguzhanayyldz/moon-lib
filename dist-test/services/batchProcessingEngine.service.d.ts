import { EventEmitter } from 'events';
import { BatchDeletionContext, BatchDeletionResult, BatchDeletionItem, BatchProcessingStrategy, ConnectionPoolConfig, BatchQueueConfig, MemoryManagementConfig, PerformanceOptimizationConfig } from '../common/interfaces/batch-deletion.interface';
/**
 * Connection pool manager for batch operations
 */
export declare class ConnectionPoolManager {
    private pools;
    private config;
    private activeConnections;
    private poolStats;
    constructor(config: ConnectionPoolConfig);
    /**
     * Get or create a connection pool for a specific resource
     */
    getPool(poolName: string): Promise<any[]>;
    /**
     * Create a new connection pool
     */
    private createPool;
    /**
     * Create a new connection
     */
    private createConnection;
    /**
     * Acquire a connection from the pool
     */
    acquireConnection(poolName: string): Promise<any>;
    /**
     * Release a connection back to the pool
     */
    releaseConnection(poolName: string, connection: any): Promise<void>;
    /**
     * Wait for a connection to become available
     */
    private waitForConnection;
    /**
     * Validate a connection
     */
    private validateConnection;
    /**
     * Remove a connection from the pool
     */
    private removeConnection;
    /**
     * Update pool statistics
     */
    private updatePoolStats;
    /**
     * Get pool statistics
     */
    getPoolStats(poolName?: string): Map<string, any> | any;
    /**
     * Cleanup idle connections
     */
    cleanupIdleConnections(): Promise<void>;
    /**
     * Close all connections and pools
     */
    closeAll(): Promise<void>;
}
/**
 * Batch queue manager for handling batch operations
 */
export declare class BatchQueueManager extends EventEmitter {
    private queues;
    private config;
    private isProcessing;
    private processingPromises;
    constructor(config: BatchQueueConfig);
    /**
     * Add items to a queue
     */
    addToQueue(queueName: string, items: BatchDeletionItem[]): Promise<void>;
    /**
     * Get items from a queue
     */
    getFromQueue(queueName: string, count: number): BatchDeletionItem[];
    /**
     * Get queue size
     */
    getQueueSize(queueName: string): number;
    /**
     * Check if queue is processing
     */
    isQueueProcessing(queueName: string): boolean;
    /**
     * Set queue processing status
     */
    setQueueProcessing(queueName: string, processing: boolean): void;
    /**
     * Clear a queue
     */
    clearQueue(queueName: string): void;
    /**
     * Get all queue names
     */
    getQueueNames(): string[];
    /**
     * Get queue statistics
     */
    getQueueStats(): Map<string, {
        size: number;
        processing: boolean;
        strategy: string;
    }>;
}
/**
 * Memory management for batch operations
 */
export declare class MemoryManager {
    private config;
    private memoryTracker;
    private monitoringInterval;
    private isMonitoring;
    constructor(config: MemoryManagementConfig);
    /**
     * Start memory monitoring
     */
    startMonitoring(): void;
    /**
     * Stop memory monitoring
     */
    stopMonitoring(): void;
    /**
     * Check current memory usage
     */
    private checkMemoryUsage;
    /**
     * Handle memory threshold exceeded
     */
    private handleMemoryThreshold;
    /**
     * Get memory usage report
     */
    getMemoryReport(): {
        current: any;
        trend: any;
        threshold: number;
        action: string;
    };
    /**
     * Take memory snapshot
     */
    takeSnapshot(label?: string): void;
}
/**
 * Main batch processing engine
 */
export declare class BatchProcessingEngine extends EventEmitter {
    private connectionPool;
    private queueManager;
    private memoryManager;
    private processingStrategies;
    private activeOperations;
    private config;
    constructor(config: {
        connectionPool: ConnectionPoolConfig;
        queue: BatchQueueConfig;
        memory: MemoryManagementConfig;
        performance: PerformanceOptimizationConfig;
    });
    /**
     * Register a batch processing strategy
     */
    registerStrategy(strategy: BatchProcessingStrategy): void;
    /**
     * Process batch deletion operation
     */
    processBatchDeletion(context: BatchDeletionContext): Promise<BatchDeletionResult>;
    /**
     * Process a batch group with a specific strategy
     */
    private processBatchGroup;
    /**
     * Validate batch configuration
     */
    private validateBatchConfig;
    /**
     * Group items by entity type
     */
    private groupItemsByEntityType;
    /**
     * Select the best processing strategy for given items
     */
    private selectBestStrategy;
    /**
     * Calculate optimal batch size
     */
    private calculateOptimalBatchSize;
    /**
     * Split items into batches
     */
    private splitIntoBatches;
    /**
     * Calculate batch metrics
     */
    private calculateBatchMetrics;
    /**
     * Get affected services from batch results
     */
    private getAffectedServices;
    /**
     * Create empty metrics object
     */
    private createEmptyMetrics;
    /**
     * Shutdown the engine
     */
    shutdown(): Promise<void>;
    /**
     * Get engine statistics
     */
    getStats(): {
        connectionPools: Map<string, any>;
        queues: Map<string, any>;
        memory: any;
        activeOperations: number;
        strategies: number;
    };
}
export declare const DEFAULT_BATCH_CONFIG: {
    connectionPool: ConnectionPoolConfig;
    queue: BatchQueueConfig;
    memory: MemoryManagementConfig;
    performance: PerformanceOptimizationConfig;
};
//# sourceMappingURL=batchProcessingEngine.service.d.ts.map