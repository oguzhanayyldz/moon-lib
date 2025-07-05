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
exports.DEFAULT_BATCH_CONFIG = exports.BatchProcessingEngine = exports.MemoryManager = exports.BatchQueueManager = exports.ConnectionPoolManager = void 0;
const events_1 = require("events");
const performanceMonitor_util_1 = require("../utils/performanceMonitor.util");
const logger_service_1 = require("./logger.service");
/**
 * Connection pool manager for batch operations
 */
class ConnectionPoolManager {
    constructor(config) {
        this.pools = new Map();
        this.activeConnections = new Map();
        this.poolStats = new Map();
        this.config = config;
    }
    /**
     * Get or create a connection pool for a specific resource
     */
    getPool(poolName) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.pools.has(poolName)) {
                yield this.createPool(poolName);
            }
            return this.pools.get(poolName);
        });
    }
    /**
     * Create a new connection pool
     */
    createPool(poolName) {
        return __awaiter(this, void 0, void 0, function* () {
            const pool = [];
            this.pools.set(poolName, pool);
            this.activeConnections.set(poolName, 0);
            // Initialize minimum connections
            for (let i = 0; i < this.config.minConnections; i++) {
                const connection = yield this.createConnection(poolName);
                pool.push(connection);
            }
            this.updatePoolStats(poolName);
            logger_service_1.logger.info(`Created connection pool: ${poolName}`, {
                minConnections: this.config.minConnections,
                maxConnections: this.config.maxConnections
            });
        });
    }
    /**
     * Create a new connection
     */
    createConnection(poolName) {
        return __awaiter(this, void 0, void 0, function* () {
            // This is a placeholder - actual implementation would depend on the specific database/service
            return {
                id: `${poolName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                poolName,
                created: Date.now(),
                lastUsed: Date.now(),
                isActive: false
            };
        });
    }
    /**
     * Acquire a connection from the pool
     */
    acquireConnection(poolName) {
        return __awaiter(this, void 0, void 0, function* () {
            const pool = yield this.getPool(poolName);
            // Find an idle connection
            let connection = pool.find(conn => !conn.isActive);
            if (!connection) {
                // Create new connection if under max limit
                const activeCount = this.activeConnections.get(poolName) || 0;
                if (activeCount < this.config.maxConnections) {
                    connection = yield this.createConnection(poolName);
                    pool.push(connection);
                }
                else {
                    // Wait for connection to become available
                    connection = yield this.waitForConnection(poolName);
                }
            }
            connection.isActive = true;
            connection.lastUsed = Date.now();
            const currentActive = this.activeConnections.get(poolName) || 0;
            this.activeConnections.set(poolName, currentActive + 1);
            this.updatePoolStats(poolName);
            return connection;
        });
    }
    /**
     * Release a connection back to the pool
     */
    releaseConnection(poolName, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            connection.isActive = false;
            connection.lastUsed = Date.now();
            const currentActive = this.activeConnections.get(poolName) || 0;
            this.activeConnections.set(poolName, Math.max(0, currentActive - 1));
            this.updatePoolStats(poolName);
            // Validate connection if enabled
            if (this.config.enableValidation && this.config.validationQuery) {
                const isValid = yield this.validateConnection(connection);
                if (!isValid) {
                    yield this.removeConnection(poolName, connection);
                }
            }
        });
    }
    /**
     * Wait for a connection to become available
     */
    waitForConnection(poolName) {
        return __awaiter(this, void 0, void 0, function* () {
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
        });
    }
    /**
     * Validate a connection
     */
    validateConnection(connection) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Placeholder validation logic
                return Date.now() - connection.created < this.config.idleTimeout;
            }
            catch (error) {
                logger_service_1.logger.warn('Connection validation failed', {
                    connectionId: connection.id,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                return false;
            }
        });
    }
    /**
     * Remove a connection from the pool
     */
    removeConnection(poolName, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            const pool = this.pools.get(poolName);
            if (pool) {
                const index = pool.indexOf(connection);
                if (index > -1) {
                    pool.splice(index, 1);
                    this.updatePoolStats(poolName);
                    logger_service_1.logger.debug('Connection removed from pool', {
                        poolName,
                        connectionId: connection.id
                    });
                }
            }
        });
    }
    /**
     * Update pool statistics
     */
    updatePoolStats(poolName) {
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
    getPoolStats(poolName) {
        if (poolName) {
            return this.poolStats.get(poolName);
        }
        return this.poolStats;
    }
    /**
     * Cleanup idle connections
     */
    cleanupIdleConnections() {
        return __awaiter(this, void 0, void 0, function* () {
            const now = Date.now();
            for (const [poolName, pool] of this.pools) {
                const connectionsToRemove = pool.filter(conn => !conn.isActive &&
                    (now - conn.lastUsed) > this.config.idleTimeout);
                for (const connection of connectionsToRemove) {
                    yield this.removeConnection(poolName, connection);
                }
            }
        });
    }
    /**
     * Close all connections and pools
     */
    closeAll() {
        return __awaiter(this, void 0, void 0, function* () {
            for (const [poolName, pool] of this.pools) {
                for (const connection of pool) {
                    // Close connection logic would go here
                    logger_service_1.logger.debug('Closing connection', {
                        poolName,
                        connectionId: connection.id
                    });
                }
            }
            this.pools.clear();
            this.activeConnections.clear();
            this.poolStats.clear();
        });
    }
}
exports.ConnectionPoolManager = ConnectionPoolManager;
/**
 * Batch queue manager for handling batch operations
 */
class BatchQueueManager extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.queues = new Map();
        this.isProcessing = new Map();
        this.processingPromises = new Map();
        this.config = config;
    }
    /**
     * Add items to a queue
     */
    addToQueue(queueName, items) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.queues.has(queueName)) {
                this.queues.set(queueName, []);
            }
            const queue = this.queues.get(queueName);
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
            logger_service_1.logger.debug(`Added ${items.length} items to queue ${queueName}`, {
                queueSize: queue.length,
                strategy: this.config.processingStrategy
            });
        });
    }
    /**
     * Get items from a queue
     */
    getFromQueue(queueName, count) {
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
    getQueueSize(queueName) {
        var _a;
        return ((_a = this.queues.get(queueName)) === null || _a === void 0 ? void 0 : _a.length) || 0;
    }
    /**
     * Check if queue is processing
     */
    isQueueProcessing(queueName) {
        return this.isProcessing.get(queueName) || false;
    }
    /**
     * Set queue processing status
     */
    setQueueProcessing(queueName, processing) {
        this.isProcessing.set(queueName, processing);
        if (processing) {
            this.emit('queue-processing-started', { queueName });
        }
        else {
            this.emit('queue-processing-stopped', { queueName });
            this.processingPromises.delete(queueName);
        }
    }
    /**
     * Clear a queue
     */
    clearQueue(queueName) {
        this.queues.delete(queueName);
        this.isProcessing.delete(queueName);
        this.processingPromises.delete(queueName);
        this.emit('queue-cleared', { queueName });
    }
    /**
     * Get all queue names
     */
    getQueueNames() {
        return Array.from(this.queues.keys());
    }
    /**
     * Get queue statistics
     */
    getQueueStats() {
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
exports.BatchQueueManager = BatchQueueManager;
/**
 * Memory management for batch operations
 */
class MemoryManager {
    constructor(config) {
        this.monitoringInterval = null;
        this.isMonitoring = false;
        this.config = config;
        this.memoryTracker = new performanceMonitor_util_1.MemoryTracker();
    }
    /**
     * Start memory monitoring
     */
    startMonitoring() {
        if (this.isMonitoring)
            return;
        this.isMonitoring = true;
        this.monitoringInterval = setInterval(() => {
            this.checkMemoryUsage();
        }, this.config.checkInterval);
        logger_service_1.logger.info('Memory monitoring started', {
            checkInterval: this.config.checkInterval,
            maxMemoryUsage: this.config.maxMemoryUsage
        });
    }
    /**
     * Stop memory monitoring
     */
    stopMonitoring() {
        if (!this.isMonitoring)
            return;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.isMonitoring = false;
        logger_service_1.logger.info('Memory monitoring stopped');
    }
    /**
     * Check current memory usage
     */
    checkMemoryUsage() {
        const usage = this.memoryTracker.getCurrentUsage();
        if (usage.heapUsed > this.config.maxMemoryUsage) {
            logger_service_1.logger.warn('Memory usage threshold exceeded', {
                current: usage.heapUsed,
                threshold: this.config.maxMemoryUsage,
                action: this.config.thresholdAction
            });
            this.handleMemoryThreshold(usage.heapUsed);
        }
        // Update performance monitor
        performanceMonitor_util_1.performanceMonitor.setMetric('memory_usage', usage.heapUsed);
    }
    /**
     * Handle memory threshold exceeded
     */
    handleMemoryThreshold(currentUsage) {
        switch (this.config.thresholdAction) {
            case 'pause':
                performanceMonitor_util_1.performanceMonitor.setMetric('memory_pause', true);
                break;
            case 'reduce_batch_size':
                performanceMonitor_util_1.performanceMonitor.setMetric('memory_reduce_batch', true);
                break;
            case 'cancel':
                performanceMonitor_util_1.performanceMonitor.setMetric('memory_cancel', true);
                break;
        }
        // Force garbage collection if enabled
        if (this.config.enableGcOptimization && global.gc) {
            global.gc();
            logger_service_1.logger.debug('Forced garbage collection due to memory threshold');
        }
    }
    /**
     * Get memory usage report
     */
    getMemoryReport() {
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
    takeSnapshot(label) {
        this.memoryTracker.takeSnapshot(label);
    }
}
exports.MemoryManager = MemoryManager;
/**
 * Main batch processing engine
 */
class BatchProcessingEngine extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.processingStrategies = new Map();
        this.activeOperations = new Map();
        this.config = config;
        this.connectionPool = new ConnectionPoolManager(config.connectionPool);
        this.queueManager = new BatchQueueManager(config.queue);
        this.memoryManager = new MemoryManager(config.memory);
        // Start monitoring
        this.memoryManager.startMonitoring();
        performanceMonitor_util_1.performanceMonitor.startMonitoring();
    }
    /**
     * Register a batch processing strategy
     */
    registerStrategy(strategy) {
        this.processingStrategies.set(strategy.name, strategy);
        logger_service_1.logger.info(`Registered batch processing strategy: ${strategy.name}`, {
            supportsParallel: strategy.supportsParallel,
            maxBatchSize: strategy.maxBatchSize
        });
    }
    /**
     * Process batch deletion operation
     */
    processBatchDeletion(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const operationId = context.requestId || `batch_${Date.now()}`;
            const timer = new performanceMonitor_util_1.PerformanceTimer(`batch_deletion_${operationId}`);
            try {
                // Take initial memory snapshot
                this.memoryManager.takeSnapshot(`batch_start_${operationId}`);
                // Validate configuration
                this.validateBatchConfig(context);
                // Group items by entity type
                const groupedItems = this.groupItemsByEntityType(context.items);
                // Process each group
                const batchResults = [];
                const errors = [];
                for (const [entityType, items] of groupedItems) {
                    try {
                        const strategy = this.selectBestStrategy(entityType, items);
                        if (!strategy) {
                            throw new Error(`No processing strategy found for entity type: ${entityType}`);
                        }
                        const result = yield this.processBatchGroup(strategy, items, context, operationId);
                        batchResults.push(result);
                    }
                    catch (error) {
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
                performanceMonitor_util_1.performanceMonitor.recordBatchMetrics(operationId, metrics);
                const result = {
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
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                timer.stop();
                logger_service_1.logger.error(`Batch processing failed: ${operationId}`, {
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
        });
    }
    /**
     * Process a batch group with a specific strategy
     */
    processBatchGroup(strategy, items, context, operationId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const batchTimer = new performanceMonitor_util_1.PerformanceTimer(`batch_group_${operationId}`);
            try {
                // Split items into optimal batches
                const optimalBatchSize = this.calculateOptimalBatchSize(strategy, items);
                const batches = this.splitIntoBatches(items, optimalBatchSize);
                // Process batches in parallel or sequentially
                const results = [];
                if (strategy.supportsParallel && batches.length > 1) {
                    // Process batches in parallel
                    const maxConcurrent = ((_a = context.config) === null || _a === void 0 ? void 0 : _a.maxConcurrentBatches) || 3;
                    const batchPromises = [];
                    for (let i = 0; i < batches.length; i += maxConcurrent) {
                        const concurrentBatches = batches.slice(i, i + maxConcurrent);
                        const batchResults = yield Promise.allSettled(concurrentBatches.map(batch => strategy.processBatch(batch, context)));
                        for (const result of batchResults) {
                            if (result.status === 'fulfilled') {
                                results.push(result.value);
                            }
                            else {
                                // Handle failed batch
                                const failedBatch = {
                                    batchId: `failed_${Date.now()}`,
                                    successfulItems: [],
                                    failedItems: concurrentBatches.map(batch => batch.map(item => {
                                        var _a;
                                        return ({
                                            entityId: item.entityId,
                                            error: ((_a = result.reason) === null || _a === void 0 ? void 0 : _a.message) || 'Unknown error'
                                        });
                                    })).flat(),
                                    executionTime: 0,
                                    databaseOperations: 0,
                                    memoryUsage: 0
                                };
                                results.push(failedBatch);
                            }
                        }
                    }
                }
                else {
                    // Process batches sequentially
                    for (const batch of batches) {
                        const result = yield strategy.processBatch(batch, context);
                        results.push(result);
                    }
                }
                // Combine results
                const combinedResult = {
                    batchId: `combined_${operationId}`,
                    successfulItems: results.flatMap(r => r.successfulItems),
                    failedItems: results.flatMap(r => r.failedItems),
                    executionTime: batchTimer.stop(),
                    databaseOperations: results.reduce((sum, r) => sum + r.databaseOperations, 0),
                    memoryUsage: Math.max(...results.map(r => r.memoryUsage))
                };
                return combinedResult;
            }
            catch (error) {
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
        });
    }
    /**
     * Validate batch configuration
     */
    validateBatchConfig(context) {
        if (!context.items || context.items.length === 0) {
            throw new Error('Batch context must contain at least one item');
        }
        const config = context.config;
        if ((config === null || config === void 0 ? void 0 : config.batchSize) && config.batchSize <= 0) {
            throw new Error('Batch size must be greater than 0');
        }
        if ((config === null || config === void 0 ? void 0 : config.maxConcurrentBatches) && config.maxConcurrentBatches <= 0) {
            throw new Error('Max concurrent batches must be greater than 0');
        }
    }
    /**
     * Group items by entity type
     */
    groupItemsByEntityType(items) {
        const groups = new Map();
        for (const item of items) {
            if (!groups.has(item.entityType)) {
                groups.set(item.entityType, []);
            }
            groups.get(item.entityType).push(item);
        }
        return groups;
    }
    /**
     * Select the best processing strategy for given items
     */
    selectBestStrategy(entityType, items) {
        const availableStrategies = Array.from(this.processingStrategies.values())
            .filter(strategy => strategy.canHandle(items));
        if (availableStrategies.length === 0) {
            return null;
        }
        // Sort by suitability (this is a simplified selection logic)
        availableStrategies.sort((a, b) => {
            // Prefer strategies that support parallel processing for large batches
            if (items.length > 50) {
                if (a.supportsParallel && !b.supportsParallel)
                    return -1;
                if (!a.supportsParallel && b.supportsParallel)
                    return 1;
            }
            // Prefer strategies with larger max batch size
            return b.maxBatchSize - a.maxBatchSize;
        });
        return availableStrategies[0];
    }
    /**
     * Calculate optimal batch size
     */
    calculateOptimalBatchSize(strategy, items) {
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
    splitIntoBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }
    /**
     * Calculate batch metrics
     */
    calculateBatchMetrics(batchResults, executionTime) {
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
    getAffectedServices(batchResults) {
        // This would extract service names from batch results
        // For now, return empty array
        return [];
    }
    /**
     * Create empty metrics object
     */
    createEmptyMetrics() {
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
    shutdown() {
        return __awaiter(this, void 0, void 0, function* () {
            this.memoryManager.stopMonitoring();
            performanceMonitor_util_1.performanceMonitor.stopMonitoring();
            yield this.connectionPool.closeAll();
            // Wait for active operations to complete
            yield Promise.allSettled(Array.from(this.activeOperations.values()));
            this.emit('shutdown');
            logger_service_1.logger.info('Batch processing engine shutdown completed');
        });
    }
    /**
     * Get engine statistics
     */
    getStats() {
        return {
            connectionPools: this.connectionPool.getPoolStats(),
            queues: this.queueManager.getQueueStats(),
            memory: this.memoryManager.getMemoryReport(),
            activeOperations: this.activeOperations.size,
            strategies: this.processingStrategies.size
        };
    }
}
exports.BatchProcessingEngine = BatchProcessingEngine;
// Export default configurations
exports.DEFAULT_BATCH_CONFIG = {
    connectionPool: {
        maxConnections: 10,
        minConnections: 2,
        connectionTimeout: 30000,
        idleTimeout: 60000,
        enableValidation: true
    },
    queue: {
        maxQueueSize: 10000,
        processingStrategy: 'fifo',
        enablePersistence: false,
        monitoringInterval: 5000
    },
    memory: {
        maxMemoryUsage: 500, // MB
        checkInterval: 10000,
        thresholdAction: 'pause',
        enableGcOptimization: true,
        reportingInterval: 30000
    },
    performance: {
        enableQueryOptimization: true,
        enableIndexHints: true,
        enableResultCaching: true,
        cacheTtl: 300,
        enableCompression: false,
        compressionAlgorithm: 'gzip'
    }
};
