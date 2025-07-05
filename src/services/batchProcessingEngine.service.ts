import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import { 
  BatchDeletionContext, 
  BatchDeletionResult, 
  BatchDeletionItem, 
  BatchResult, 
  BatchProcessingStrategy,
  ConnectionPoolConfig,
  BatchQueueConfig,
  MemoryManagementConfig,
  PerformanceOptimizationConfig,
  ResourceUsage
} from '../common/interfaces/batch-deletion.interface';
import { performanceMonitor, PerformanceTimer, MemoryTracker } from '../utils/performanceMonitor.util';
import { logger } from './logger.service';

/**
 * Connection pool manager for batch operations
 */
export class ConnectionPoolManager {
  private pools: Map<string, any[]> = new Map();
  private config: ConnectionPoolConfig;
  private activeConnections: Map<string, number> = new Map();
  private poolStats: Map<string, { 
    total: number; 
    active: number; 
    idle: number; 
    waiting: number; 
  }> = new Map();

  constructor(config: ConnectionPoolConfig) {
    this.config = config;
  }

  /**
   * Get or create a connection pool for a specific resource
   */
  public async getPool(poolName: string): Promise<any[]> {
    if (!this.pools.has(poolName)) {
      await this.createPool(poolName);
    }
    return this.pools.get(poolName)!;
  }

  /**
   * Create a new connection pool
   */
  private async createPool(poolName: string): Promise<void> {
    const pool: any[] = [];
    this.pools.set(poolName, pool);
    this.activeConnections.set(poolName, 0);
    
    // Initialize minimum connections
    for (let i = 0; i < this.config.minConnections; i++) {
      const connection = await this.createConnection(poolName);
      pool.push(connection);
    }

    this.updatePoolStats(poolName);
    
    logger.info(`Created connection pool: ${poolName}`, {
      minConnections: this.config.minConnections,
      maxConnections: this.config.maxConnections
    });
  }

  /**
   * Create a new connection
   */
  private async createConnection(poolName: string): Promise<any> {
    // This is a placeholder - actual implementation would depend on the specific database/service
    return {
      id: `${poolName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      poolName,
      created: Date.now(),
      lastUsed: Date.now(),
      isActive: false
    };
  }

  /**
   * Acquire a connection from the pool
   */
  public async acquireConnection(poolName: string): Promise<any> {
    const pool = await this.getPool(poolName);
    
    // Find an idle connection
    let connection = pool.find(conn => !conn.isActive);
    
    if (!connection) {
      // Create new connection if under max limit
      const activeCount = this.activeConnections.get(poolName) || 0;
      if (activeCount < this.config.maxConnections) {
        connection = await this.createConnection(poolName);
        pool.push(connection);
      } else {
        // Wait for connection to become available
        connection = await this.waitForConnection(poolName);
      }
    }

    connection.isActive = true;
    connection.lastUsed = Date.now();
    
    const currentActive = this.activeConnections.get(poolName) || 0;
    this.activeConnections.set(poolName, currentActive + 1);
    
    this.updatePoolStats(poolName);
    
    return connection;
  }

  /**
   * Release a connection back to the pool
   */
  public async releaseConnection(poolName: string, connection: any): Promise<void> {
    connection.isActive = false;
    connection.lastUsed = Date.now();
    
    const currentActive = this.activeConnections.get(poolName) || 0;
    this.activeConnections.set(poolName, Math.max(0, currentActive - 1));
    
    this.updatePoolStats(poolName);
    
    // Validate connection if enabled
    if (this.config.enableValidation && this.config.validationQuery) {
      const isValid = await this.validateConnection(connection);
      if (!isValid) {
        await this.removeConnection(poolName, connection);
      }
    }
  }

  /**
   * Wait for a connection to become available
   */
  private async waitForConnection(poolName: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Connection pool timeout for ${poolName}`));
      }, this.config.connectionTimeout);

      const checkForConnection = () => {
        const pool = this.pools.get(poolName);
        if (pool) {
          const idleConnection = pool.find(conn => !conn.isActive);
          if (idleConnection) {
            clearTimeout(timeout);
            resolve(idleConnection);
            return;
          }
        }
        setTimeout(checkForConnection, 100);
      };

      checkForConnection();
    });
  }

  /**
   * Validate a connection
   */
  private async validateConnection(connection: any): Promise<boolean> {
    try {
      // Placeholder validation logic
      return Date.now() - connection.created < this.config.idleTimeout;
    } catch (error) {
      logger.warn('Connection validation failed', { 
        connectionId: connection.id, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  /**
   * Remove a connection from the pool
   */
  private async removeConnection(poolName: string, connection: any): Promise<void> {
    const pool = this.pools.get(poolName);
    if (pool) {
      const index = pool.indexOf(connection);
      if (index > -1) {
        pool.splice(index, 1);
        this.updatePoolStats(poolName);
        
        logger.debug('Connection removed from pool', {
          poolName,
          connectionId: connection.id
        });
      }
    }
  }

  /**
   * Update pool statistics
   */
  private updatePoolStats(poolName: string): void {
    const pool = this.pools.get(poolName);
    if (pool) {
      const active = pool.filter(conn => conn.isActive).length;
      const idle = pool.length - active;
      
      this.poolStats.set(poolName, {
        total: pool.length,
        active,
        idle,
        waiting: 0 // This would be tracked in a real implementation
      });
    }
  }

  /**
   * Get pool statistics
   */
  public getPoolStats(poolName?: string): Map<string, any> | any {
    if (poolName) {
      return this.poolStats.get(poolName);
    }
    return this.poolStats;
  }

  /**
   * Cleanup idle connections
   */
  public async cleanupIdleConnections(): Promise<void> {
    const now = Date.now();
    
    for (const [poolName, pool] of this.pools) {
      const connectionsToRemove = pool.filter(conn => 
        !conn.isActive && 
        (now - conn.lastUsed) > this.config.idleTimeout
      );
      
      for (const connection of connectionsToRemove) {
        await this.removeConnection(poolName, connection);
      }
    }
  }

  /**
   * Close all connections and pools
   */
  public async closeAll(): Promise<void> {
    for (const [poolName, pool] of this.pools) {
      for (const connection of pool) {
        // Close connection logic would go here
        logger.debug('Closing connection', { 
          poolName, 
          connectionId: connection.id 
        });
      }
    }
    
    this.pools.clear();
    this.activeConnections.clear();
    this.poolStats.clear();
  }
}

/**
 * Batch queue manager for handling batch operations
 */
export class BatchQueueManager extends EventEmitter {
  private queues: Map<string, BatchDeletionItem[]> = new Map();
  private config: BatchQueueConfig;
  private isProcessing: Map<string, boolean> = new Map();
  private processingPromises: Map<string, Promise<any>> = new Map();

  constructor(config: BatchQueueConfig) {
    super();
    this.config = config;
  }

  /**
   * Add items to a queue
   */
  public async addToQueue(queueName: string, items: BatchDeletionItem[]): Promise<void> {
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, []);
    }

    const queue = this.queues.get(queueName)!;
    
    // Check queue size limit
    if (queue.length + items.length > this.config.maxQueueSize) {
      throw new Error(`Queue ${queueName} would exceed maximum size of ${this.config.maxQueueSize}`);
    }

    // Add items based on processing strategy
    switch (this.config.processingStrategy) {
      case 'fifo':
        queue.push(...items);
        break;
      case 'lifo':
        queue.unshift(...items);
        break;
      case 'priority':
        queue.push(...items);
        queue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        break;
    }

    this.emit('items-added', {
      queueName,
      itemCount: items.length,
      totalQueueSize: queue.length
    });

    logger.debug(`Added ${items.length} items to queue ${queueName}`, {
      queueSize: queue.length,
      strategy: this.config.processingStrategy
    });
  }

  /**
   * Get items from a queue
   */
  public getFromQueue(queueName: string, count: number): BatchDeletionItem[] {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return [];
    }

    const items = queue.splice(0, count);
    
    this.emit('items-removed', {
      queueName,
      itemCount: items.length,
      remainingQueueSize: queue.length
    });

    return items;
  }

  /**
   * Get queue size
   */
  public getQueueSize(queueName: string): number {
    return this.queues.get(queueName)?.length || 0;
  }

  /**
   * Check if queue is processing
   */
  public isQueueProcessing(queueName: string): boolean {
    return this.isProcessing.get(queueName) || false;
  }

  /**
   * Set queue processing status
   */
  public setQueueProcessing(queueName: string, processing: boolean): void {
    this.isProcessing.set(queueName, processing);
    
    if (processing) {
      this.emit('queue-processing-started', { queueName });
    } else {
      this.emit('queue-processing-stopped', { queueName });
      this.processingPromises.delete(queueName);
    }
  }

  /**
   * Clear a queue
   */
  public clearQueue(queueName: string): void {
    this.queues.delete(queueName);
    this.isProcessing.delete(queueName);
    this.processingPromises.delete(queueName);
    
    this.emit('queue-cleared', { queueName });
  }

  /**
   * Get all queue names
   */
  public getQueueNames(): string[] {
    return Array.from(this.queues.keys());
  }

  /**
   * Get queue statistics
   */
  public getQueueStats(): Map<string, { 
    size: number; 
    processing: boolean; 
    strategy: string; 
  }> {
    const stats = new Map();
    
    for (const queueName of this.queues.keys()) {
      stats.set(queueName, {
        size: this.getQueueSize(queueName),
        processing: this.isQueueProcessing(queueName),
        strategy: this.config.processingStrategy
      });
    }
    
    return stats;
  }
}

/**
 * Memory management for batch operations
 */
export class MemoryManager {
  private config: MemoryManagementConfig;
  private memoryTracker: MemoryTracker;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  constructor(config: MemoryManagementConfig) {
    this.config = config;
    this.memoryTracker = new MemoryTracker();
  }

  /**
   * Start memory monitoring
   */
  public startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.config.checkInterval);

    logger.info('Memory monitoring started', {
      checkInterval: this.config.checkInterval,
      maxMemoryUsage: this.config.maxMemoryUsage
    });
  }

  /**
   * Stop memory monitoring
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) return;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isMonitoring = false;
    logger.info('Memory monitoring stopped');
  }

  /**
   * Check current memory usage
   */
  private checkMemoryUsage(): void {
    const usage = this.memoryTracker.getCurrentUsage();
    
    if (usage.heapUsed > this.config.maxMemoryUsage) {
      logger.warn('Memory usage threshold exceeded', {
        current: usage.heapUsed,
        threshold: this.config.maxMemoryUsage,
        action: this.config.thresholdAction
      });

      this.handleMemoryThreshold(usage.heapUsed);
    }

    // Update performance monitor
    performanceMonitor.setMetric('memory_usage', usage.heapUsed);
  }

  /**
   * Handle memory threshold exceeded
   */
  private handleMemoryThreshold(currentUsage: number): void {
    switch (this.config.thresholdAction) {
      case 'pause':
        performanceMonitor.setMetric('memory_pause', true);
        break;
      case 'reduce_batch_size':
        performanceMonitor.setMetric('memory_reduce_batch', true);
        break;
      case 'cancel':
        performanceMonitor.setMetric('memory_cancel', true);
        break;
    }

    // Force garbage collection if enabled
    if (this.config.enableGcOptimization && global.gc) {
      global.gc();
      logger.debug('Forced garbage collection due to memory threshold');
    }
  }

  /**
   * Get memory usage report
   */
  public getMemoryReport(): {
    current: any;
    trend: any;
    threshold: number;
    action: string;
  } {
    return {
      current: this.memoryTracker.getCurrentUsage(),
      trend: this.memoryTracker.getTrend(),
      threshold: this.config.maxMemoryUsage,
      action: this.config.thresholdAction
    };
  }

  /**
   * Take memory snapshot
   */
  public takeSnapshot(label?: string): void {
    this.memoryTracker.takeSnapshot(label);
  }
}

/**
 * Main batch processing engine
 */
export class BatchProcessingEngine extends EventEmitter {
  private connectionPool: ConnectionPoolManager;
  private queueManager: BatchQueueManager;
  private memoryManager: MemoryManager;
  private processingStrategies: Map<string, BatchProcessingStrategy> = new Map();
  private activeOperations: Map<string, Promise<BatchDeletionResult>> = new Map();
  private config: {
    connectionPool: ConnectionPoolConfig;
    queue: BatchQueueConfig;
    memory: MemoryManagementConfig;
    performance: PerformanceOptimizationConfig;
  };

  constructor(config: {
    connectionPool: ConnectionPoolConfig;
    queue: BatchQueueConfig;
    memory: MemoryManagementConfig;
    performance: PerformanceOptimizationConfig;
  }) {
    super();
    this.config = config;
    this.connectionPool = new ConnectionPoolManager(config.connectionPool);
    this.queueManager = new BatchQueueManager(config.queue);
    this.memoryManager = new MemoryManager(config.memory);

    // Start monitoring
    this.memoryManager.startMonitoring();
    performanceMonitor.startMonitoring();
  }

  /**
   * Register a batch processing strategy
   */
  public registerStrategy(strategy: BatchProcessingStrategy): void {
    this.processingStrategies.set(strategy.name, strategy);
    
    logger.info(`Registered batch processing strategy: ${strategy.name}`, {
      supportsParallel: strategy.supportsParallel,
      maxBatchSize: strategy.maxBatchSize
    });
  }

  /**
   * Process batch deletion operation
   */
  public async processBatchDeletion(context: BatchDeletionContext): Promise<BatchDeletionResult> {
    const operationId = context.requestId || `batch_${Date.now()}`;
    const timer = new PerformanceTimer(`batch_deletion_${operationId}`);
    
    try {
      // Take initial memory snapshot
      this.memoryManager.takeSnapshot(`batch_start_${operationId}`);
      
      // Validate configuration
      this.validateBatchConfig(context);
      
      // Group items by entity type
      const groupedItems = this.groupItemsByEntityType(context.items);
      
      // Process each group
      const batchResults: BatchResult[] = [];
      const errors: any[] = [];
      
      for (const [entityType, items] of groupedItems) {
        try {
          const strategy = this.selectBestStrategy(entityType, items);
          if (!strategy) {
            throw new Error(`No processing strategy found for entity type: ${entityType}`);
          }

          const result = await this.processBatchGroup(
            strategy,
            items,
            context,
            operationId
          );
          
          batchResults.push(result);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push({
            entityType,
            error: errorMessage,
            items: items.map(item => item.entityId)
          });
        }
      }

      // Take final memory snapshot
      this.memoryManager.takeSnapshot(`batch_end_${operationId}`);
      
      // Calculate metrics
      const executionTime = timer.stop();
      const metrics = this.calculateBatchMetrics(batchResults, executionTime);
      
      // Record performance metrics
      performanceMonitor.recordBatchMetrics(operationId, metrics);
      
      const result: BatchDeletionResult = {
        success: errors.length === 0,
        batchResults,
        metrics,
        affectedServices: this.getAffectedServices(batchResults),
        errors: errors.length > 0 ? errors : undefined
      };

      // Emit completion event
      this.emit('batch-completed', {
        operationId,
        result,
        executionTime
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      timer.stop();
      
      logger.error(`Batch processing failed: ${operationId}`, {
        error: errorMessage,
        itemCount: context.items.length
      });

      return {
        success: false,
        batchResults: [],
        metrics: this.createEmptyMetrics(),
        affectedServices: [],
        error: errorMessage
      };
    }
  }

  /**
   * Process a batch group with a specific strategy
   */
  private async processBatchGroup(
    strategy: BatchProcessingStrategy,
    items: BatchDeletionItem[],
    context: BatchDeletionContext,
    operationId: string
  ): Promise<BatchResult> {
    const batchTimer = new PerformanceTimer(`batch_group_${operationId}`);
    
    try {
      // Split items into optimal batches
      const optimalBatchSize = this.calculateOptimalBatchSize(strategy, items);
      const batches = this.splitIntoBatches(items, optimalBatchSize);
      
      // Process batches in parallel or sequentially
      const results: BatchResult[] = [];
      
      if (strategy.supportsParallel && batches.length > 1) {
        // Process batches in parallel
        const maxConcurrent = context.config?.maxConcurrentBatches || 3;
        const batchPromises: Promise<BatchResult>[] = [];
        
        for (let i = 0; i < batches.length; i += maxConcurrent) {
          const concurrentBatches = batches.slice(i, i + maxConcurrent);
          const batchResults = await Promise.allSettled(
            concurrentBatches.map(batch => 
              strategy.processBatch(batch, context)
            )
          );
          
          for (const result of batchResults) {
            if (result.status === 'fulfilled') {
              results.push(result.value);
            } else {
              // Handle failed batch
              const failedBatch: BatchResult = {
                batchId: `failed_${Date.now()}`,
                successfulItems: [],
                failedItems: concurrentBatches.map(batch => 
                  batch.map(item => ({
                    entityId: item.entityId,
                    error: result.reason?.message || 'Unknown error'
                  }))
                ).flat(),
                executionTime: 0,
                databaseOperations: 0,
                memoryUsage: 0
              };
              results.push(failedBatch);
            }
          }
        }
      } else {
        // Process batches sequentially
        for (const batch of batches) {
          const result = await strategy.processBatch(batch, context);
          results.push(result);
        }
      }

      // Combine results
      const combinedResult: BatchResult = {
        batchId: `combined_${operationId}`,
        successfulItems: results.flatMap(r => r.successfulItems),
        failedItems: results.flatMap(r => r.failedItems),
        executionTime: batchTimer.stop(),
        databaseOperations: results.reduce((sum, r) => sum + r.databaseOperations, 0),
        memoryUsage: Math.max(...results.map(r => r.memoryUsage))
      };

      return combinedResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        batchId: `error_${operationId}`,
        successfulItems: [],
        failedItems: items.map(item => ({
          entityId: item.entityId,
          error: errorMessage
        })),
        executionTime: batchTimer.stop(),
        databaseOperations: 0,
        memoryUsage: this.memoryManager.getMemoryReport().current.heapUsed
      };
    }
  }

  /**
   * Validate batch configuration
   */
  private validateBatchConfig(context: BatchDeletionContext): void {
    if (!context.items || context.items.length === 0) {
      throw new Error('Batch context must contain at least one item');
    }

    const config = context.config;
    if (config?.batchSize && config.batchSize <= 0) {
      throw new Error('Batch size must be greater than 0');
    }

    if (config?.maxConcurrentBatches && config.maxConcurrentBatches <= 0) {
      throw new Error('Max concurrent batches must be greater than 0');
    }
  }

  /**
   * Group items by entity type
   */
  private groupItemsByEntityType(items: BatchDeletionItem[]): Map<string, BatchDeletionItem[]> {
    const groups = new Map<string, BatchDeletionItem[]>();
    
    for (const item of items) {
      if (!groups.has(item.entityType)) {
        groups.set(item.entityType, []);
      }
      groups.get(item.entityType)!.push(item);
    }
    
    return groups;
  }

  /**
   * Select the best processing strategy for given items
   */
  private selectBestStrategy(entityType: string, items: BatchDeletionItem[]): BatchProcessingStrategy | null {
    const availableStrategies = Array.from(this.processingStrategies.values())
      .filter(strategy => strategy.canHandle(items));
    
    if (availableStrategies.length === 0) {
      return null;
    }
    
    // Sort by suitability (this is a simplified selection logic)
    availableStrategies.sort((a, b) => {
      // Prefer strategies that support parallel processing for large batches
      if (items.length > 50) {
        if (a.supportsParallel && !b.supportsParallel) return -1;
        if (!a.supportsParallel && b.supportsParallel) return 1;
      }
      
      // Prefer strategies with larger max batch size
      return b.maxBatchSize - a.maxBatchSize;
    });
    
    return availableStrategies[0];
  }

  /**
   * Calculate optimal batch size
   */
  private calculateOptimalBatchSize(strategy: BatchProcessingStrategy, items: BatchDeletionItem[]): number {
    const maxBatchSize = Math.min(strategy.maxBatchSize, 1000); // Hard limit
    const itemCount = items.length;
    
    // For small item counts, use single batch
    if (itemCount <= maxBatchSize) {
      return itemCount;
    }
    
    // Calculate optimal size based on memory and performance
    const memoryUsage = this.memoryManager.getMemoryReport().current.heapUsed;
    const memoryThreshold = this.config.memory.maxMemoryUsage;
    
    let optimalSize = maxBatchSize;
    
    // Reduce batch size if memory usage is high
    if (memoryUsage > memoryThreshold * 0.8) {
      optimalSize = Math.floor(maxBatchSize * 0.5);
    }
    
    // Ensure minimum batch size
    return Math.max(optimalSize, 10);
  }

  /**
   * Split items into batches
   */
  private splitIntoBatches(items: BatchDeletionItem[], batchSize: number): BatchDeletionItem[][] {
    const batches: BatchDeletionItem[][] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    return batches;
  }

  /**
   * Calculate batch metrics
   */
  private calculateBatchMetrics(batchResults: BatchResult[], executionTime: number): any {
    const totalItems = batchResults.reduce((sum, r) => sum + r.successfulItems.length + r.failedItems.length, 0);
    const successfulDeletions = batchResults.reduce((sum, r) => sum + r.successfulItems.length, 0);
    const failedDeletions = batchResults.reduce((sum, r) => sum + r.failedItems.length, 0);
    const databaseOperations = batchResults.reduce((sum, r) => sum + r.databaseOperations, 0);
    const peakMemoryUsage = Math.max(...batchResults.map(r => r.memoryUsage));

    return {
      totalItems,
      successfulDeletions,
      failedDeletions,
      totalExecutionTime: executionTime,
      averageTimePerItem: totalItems > 0 ? executionTime / totalItems : 0,
      batchesProcessed: batchResults.length,
      parallelOperations: batchResults.length,
      peakMemoryUsage,
      databaseOperations,
      networkOperations: 0, // Would be tracked in actual implementation
      retriesPerformed: 0 // Would be tracked in actual implementation
    };
  }

  /**
   * Get affected services from batch results
   */
  private getAffectedServices(batchResults: BatchResult[]): string[] {
    // This would extract service names from batch results
    // For now, return empty array
    return [];
  }

  /**
   * Create empty metrics object
   */
  private createEmptyMetrics(): any {
    return {
      totalItems: 0,
      successfulDeletions: 0,
      failedDeletions: 0,
      totalExecutionTime: 0,
      averageTimePerItem: 0,
      batchesProcessed: 0,
      parallelOperations: 0,
      peakMemoryUsage: 0,
      databaseOperations: 0,
      networkOperations: 0,
      retriesPerformed: 0
    };
  }

  /**
   * Shutdown the engine
   */
  public async shutdown(): Promise<void> {
    this.memoryManager.stopMonitoring();
    performanceMonitor.stopMonitoring();
    await this.connectionPool.closeAll();
    
    // Wait for active operations to complete
    await Promise.allSettled(Array.from(this.activeOperations.values()));
    
    this.emit('shutdown');
    logger.info('Batch processing engine shutdown completed');
  }

  /**
   * Get engine statistics
   */
  public getStats(): {
    connectionPools: Map<string, any>;
    queues: Map<string, any>;
    memory: any;
    activeOperations: number;
    strategies: number;
  } {
    return {
      connectionPools: this.connectionPool.getPoolStats(),
      queues: this.queueManager.getQueueStats(),
      memory: this.memoryManager.getMemoryReport(),
      activeOperations: this.activeOperations.size,
      strategies: this.processingStrategies.size
    };
  }
}

// Export default configurations
export const DEFAULT_BATCH_CONFIG = {
  connectionPool: {
    maxConnections: 10,
    minConnections: 2,
    connectionTimeout: 30000,
    idleTimeout: 60000,
    enableValidation: true
  } as ConnectionPoolConfig,
  
  queue: {
    maxQueueSize: 10000,
    processingStrategy: 'fifo' as const,
    enablePersistence: false,
    monitoringInterval: 5000
  } as BatchQueueConfig,
  
  memory: {
    maxMemoryUsage: 500, // MB
    checkInterval: 10000,
    thresholdAction: 'pause' as const,
    enableGcOptimization: true,
    reportingInterval: 30000
  } as MemoryManagementConfig,
  
  performance: {
    enableQueryOptimization: true,
    enableIndexHints: true,
    enableResultCaching: true,
    cacheTtl: 300,
    enableCompression: false,
    compressionAlgorithm: 'gzip' as const
  } as PerformanceOptimizationConfig
};