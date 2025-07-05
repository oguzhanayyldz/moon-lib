"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbstractBatchDeletionStrategy = void 0;
const abstractDeletionStrategy_1 = require("./abstractDeletionStrategy");
const performanceMonitor_util_1 = require("../../utils/performanceMonitor.util");
/**
 * Abstract batch deletion strategy that extends single deletion strategy
 * with batch processing capabilities
 */
class AbstractBatchDeletionStrategy extends abstractDeletionStrategy_1.AbstractDeletionStrategy {
    constructor(entityType, serviceName, priority = 1, version = '1.0.0', ownership = abstractDeletionStrategy_1.EntityOwnership.NATIVE, deletionType = abstractDeletionStrategy_1.DeletionType.SOFT, maxBatchSize = 100) {
        super(entityType, serviceName, priority, version, ownership, deletionType);
        this.supportsBatch = true;
        this.maxBatchSize = maxBatchSize;
    }
    /**
     * Process a batch of items for deletion
     * Default implementation processes items sequentially
     * Override this method for optimized batch processing
     */
    async processBatch(items, context) {
        const batchId = this.generateBatchId();
        const timer = new performanceMonitor_util_1.PerformanceTimer(`batch_${batchId}`);
        try {
            // Validate batch before processing
            const batchValidation = await this.validateBatch(items, context);
            if (!batchValidation.isValid) {
                return this.createBatchFailureResult(batchId, items, `Batch validation failed: ${batchValidation.errors.join(', ')}`);
            }
            // Prepare items for batch processing
            const preparedItems = this.prepareItemsForBatch(items);
            // Check if items can be processed in parallel
            const canProcessInParallel = this.canProcessInParallel(preparedItems);
            let result;
            if (canProcessInParallel && preparedItems.length > 1) {
                result = await this.processBatchInParallel(preparedItems, context, batchId);
            }
            else {
                result = await this.processBatchSequentially(preparedItems, context, batchId);
            }
            // Update performance metrics
            const executionTime = timer.stop();
            result.executionTime = executionTime;
            // Log batch completion
            this.logBatchOperation(batchId, result);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            timer.stop();
            this.logger.error(`Batch processing failed: ${batchId}`, {
                entityType: this.entityType,
                serviceName: this.serviceName,
                itemCount: items.length,
                error: errorMessage
            });
            return this.createBatchFailureResult(batchId, items, errorMessage);
        }
    }
    /**
     * Validate batch deletion operation
     */
    async validateBatch(items, context) {
        const errors = [];
        // Basic validation
        if (!items || items.length === 0) {
            errors.push('Batch must contain at least one item');
        }
        if (items.length > this.maxBatchSize) {
            errors.push(`Batch size ${items.length} exceeds maximum ${this.maxBatchSize}`);
        }
        // Validate each item
        for (const item of items) {
            if (!item.entityId) {
                errors.push(`Item missing entityId: ${JSON.stringify(item)}`);
            }
            if (item.entityType !== this.entityType) {
                errors.push(`Item has wrong entity type: expected ${this.entityType}, got ${item.entityType}`);
            }
        }
        // Custom validation - override in subclasses
        const customValidation = await this.validateBatchCustom(items, context);
        if (customValidation.errors.length > 0) {
            errors.push(...customValidation.errors);
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    /**
     * Custom batch validation - override in subclasses
     */
    async validateBatchCustom(items, context) {
        return { errors: [] };
    }
    /**
     * Estimate batch processing complexity
     */
    async estimateBatchComplexity(items) {
        // Base complexity calculation
        let complexity = items.length;
        // Add complexity for dependencies
        for (const item of items) {
            if (item.dependencies && item.dependencies.length > 0) {
                complexity += item.dependencies.length * 2;
            }
        }
        // Add complexity for cross-service operations
        if (this.isForeignEntity()) {
            complexity *= 1.5;
        }
        // Custom complexity calculation
        const customComplexity = await this.calculateCustomComplexity(items);
        complexity += customComplexity;
        return Math.round(complexity);
    }
    /**
     * Calculate custom complexity - override in subclasses
     */
    async calculateCustomComplexity(items) {
        return 0;
    }
    /**
     * Get optimal batch size for given items
     */
    getOptimalBatchSize(items) {
        const baseSize = Math.min(this.maxBatchSize, items.length);
        // Adjust based on memory constraints
        const memoryUsage = performanceMonitor_util_1.performanceMonitor.getCurrentResourceUsage().memoryUsage;
        const memoryThreshold = 512; // MB
        if (memoryUsage > memoryThreshold) {
            return Math.max(10, Math.floor(baseSize * 0.5));
        }
        // Adjust based on item complexity
        const hasComplexItems = items.some(item => item.dependencies && item.dependencies.length > 0);
        if (hasComplexItems) {
            return Math.max(10, Math.floor(baseSize * 0.7));
        }
        return baseSize;
    }
    /**
     * Check if items can be processed in parallel
     */
    canProcessInParallel(items) {
        // Check for dependencies between items
        const entityIds = new Set(items.map(item => item.entityId));
        for (const item of items) {
            if (item.dependencies) {
                for (const dependency of item.dependencies) {
                    if (entityIds.has(dependency)) {
                        return false; // Items have dependencies on each other
                    }
                }
            }
        }
        // Check if strategy supports parallel processing
        return this.supportsParallelProcessing();
    }
    /**
     * Check if strategy supports parallel processing - override in subclasses
     */
    supportsParallelProcessing() {
        return true;
    }
    /**
     * Prepare items for batch processing (sorting, grouping, etc.)
     */
    prepareItemsForBatch(items) {
        // Sort by priority (higher priority first)
        const sorted = [...items].sort((a, b) => (b.priority || 0) - (a.priority || 0));
        // Group by dependencies
        const withDependencies = sorted.filter(item => item.dependencies && item.dependencies.length > 0);
        const withoutDependencies = sorted.filter(item => !item.dependencies || item.dependencies.length === 0);
        // Process items with dependencies first
        return [...withDependencies, ...withoutDependencies];
    }
    /**
     * Process batch items sequentially
     */
    async processBatchSequentially(items, context, batchId) {
        var _a;
        const successfulItems = [];
        const failedItems = [];
        let databaseOperations = 0;
        for (const item of items) {
            try {
                const deletionContext = {
                    entityType: item.entityType,
                    entityId: item.entityId,
                    userId: context.userId,
                    requestId: context.requestId,
                    metadata: Object.assign(Object.assign({}, context.metadata), item.metadata),
                    transaction: context.transaction,
                    config: context.config,
                    traceSpan: context.traceSpan,
                    serviceName: context.serviceName
                };
                const result = await this.execute(deletionContext);
                if (result.success) {
                    successfulItems.push(item.entityId);
                    databaseOperations += ((_a = result.metrics) === null || _a === void 0 ? void 0 : _a.databaseOperations) || 1;
                }
                else {
                    failedItems.push({
                        entityId: item.entityId,
                        error: result.error || 'Unknown error'
                    });
                }
            }
            catch (error) {
                failedItems.push({
                    entityId: item.entityId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        return {
            batchId,
            successfulItems,
            failedItems,
            executionTime: 0, // Will be set by caller
            databaseOperations,
            memoryUsage: performanceMonitor_util_1.performanceMonitor.getCurrentResourceUsage().memoryUsage
        };
    }
    /**
     * Process batch items in parallel
     */
    async processBatchInParallel(items, context, batchId) {
        var _a, _b;
        const maxConcurrency = ((_a = context.config) === null || _a === void 0 ? void 0 : _a.maxConcurrentBatches) || 5;
        const semaphore = new Array(maxConcurrency).fill(null);
        const processItem = async (item) => {
            var _a;
            try {
                const deletionContext = {
                    entityType: item.entityType,
                    entityId: item.entityId,
                    userId: context.userId,
                    requestId: context.requestId,
                    metadata: Object.assign(Object.assign({}, context.metadata), item.metadata),
                    transaction: context.transaction,
                    config: context.config,
                    traceSpan: context.traceSpan,
                    serviceName: context.serviceName
                };
                const result = await this.execute(deletionContext);
                return {
                    success: result.success,
                    entityId: item.entityId,
                    error: result.error,
                    databaseOperations: ((_a = result.metrics) === null || _a === void 0 ? void 0 : _a.databaseOperations) || 1
                };
            }
            catch (error) {
                return {
                    success: false,
                    entityId: item.entityId,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    databaseOperations: 0
                };
            }
        };
        // Process items with limited concurrency
        const results = await Promise.allSettled(items.map(item => processItem(item)));
        const successfulItems = [];
        const failedItems = [];
        let databaseOperations = 0;
        for (const result of results) {
            if (result.status === 'fulfilled') {
                const itemResult = result.value;
                if (itemResult.success) {
                    successfulItems.push(itemResult.entityId);
                    databaseOperations += itemResult.databaseOperations;
                }
                else {
                    failedItems.push({
                        entityId: itemResult.entityId,
                        error: itemResult.error || 'Unknown error'
                    });
                }
            }
            else {
                failedItems.push({
                    entityId: 'unknown',
                    error: ((_b = result.reason) === null || _b === void 0 ? void 0 : _b.message) || 'Promise rejected'
                });
            }
        }
        return {
            batchId,
            successfulItems,
            failedItems,
            executionTime: 0, // Will be set by caller
            databaseOperations,
            memoryUsage: performanceMonitor_util_1.performanceMonitor.getCurrentResourceUsage().memoryUsage
        };
    }
    /**
     * Generate unique batch ID
     */
    generateBatchId() {
        return `batch_${this.entityType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Create batch failure result
     */
    createBatchFailureResult(batchId, items, error) {
        return {
            batchId,
            successfulItems: [],
            failedItems: items.map(item => ({
                entityId: item.entityId,
                error
            })),
            executionTime: 0,
            databaseOperations: 0,
            memoryUsage: performanceMonitor_util_1.performanceMonitor.getCurrentResourceUsage().memoryUsage
        };
    }
    /**
     * Log batch operation details
     */
    logBatchOperation(batchId, result) {
        const success = result.failedItems.length === 0;
        const logLevel = success ? 'info' : 'warn';
        this.logger[logLevel](`Batch operation completed: ${batchId}`, {
            entityType: this.entityType,
            serviceName: this.serviceName,
            batchId,
            successfulItems: result.successfulItems.length,
            failedItems: result.failedItems.length,
            executionTime: result.executionTime,
            databaseOperations: result.databaseOperations,
            memoryUsage: result.memoryUsage
        });
    }
    /**
     * Optimize batch processing based on current conditions
     */
    async optimizeBatchProcessing(items, context) {
        const complexity = await this.estimateBatchComplexity(items);
        const canParallel = this.canProcessInParallel(items);
        const memoryUsage = performanceMonitor_util_1.performanceMonitor.getCurrentResourceUsage().memoryUsage;
        // Calculate optimal batch size
        let optimizedBatchSize = this.getOptimalBatchSize(items);
        // Adjust based on system load
        if (memoryUsage > 400) {
            optimizedBatchSize = Math.floor(optimizedBatchSize * 0.7);
        }
        // Determine processing strategy
        const processingStrategy = canParallel && items.length > 10 ? 'parallel' : 'sequential';
        // Estimate processing time
        const baseTimePerItem = 100; // milliseconds
        const complexityMultiplier = Math.max(1, complexity / items.length);
        const estimatedTime = items.length * baseTimePerItem * complexityMultiplier;
        return {
            optimizedBatchSize,
            processingStrategy,
            estimatedTime
        };
    }
    /**
     * Handle batch processing errors with retry logic
     */
    async handleBatchError(error, items, context, retryCount = 0) {
        var _a;
        const maxRetries = ((_a = context.config) === null || _a === void 0 ? void 0 : _a.maxRetries) || 3;
        if (retryCount >= maxRetries) {
            this.logger.error(`Batch processing failed after ${maxRetries} retries`, {
                entityType: this.entityType,
                serviceName: this.serviceName,
                itemCount: items.length,
                error: error.message
            });
            return null;
        }
        // Implement exponential backoff
        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
        await new Promise(resolve => setTimeout(resolve, delay));
        this.logger.warn(`Retrying batch processing (attempt ${retryCount + 1}/${maxRetries})`, {
            entityType: this.entityType,
            serviceName: this.serviceName,
            itemCount: items.length,
            delay
        });
        try {
            return await this.processBatch(items, context);
        }
        catch (retryError) {
            return await this.handleBatchError(retryError instanceof Error ? retryError : new Error('Unknown retry error'), items, context, retryCount + 1);
        }
    }
    /**
     * Split large batches into smaller chunks
     */
    splitBatch(items, chunkSize) {
        const chunks = [];
        for (let i = 0; i < items.length; i += chunkSize) {
            chunks.push(items.slice(i, i + chunkSize));
        }
        return chunks;
    }
    /**
     * Merge multiple batch results
     */
    mergeBatchResults(results) {
        const mergedResult = {
            batchId: `merged_${Date.now()}`,
            successfulItems: [],
            failedItems: [],
            executionTime: 0,
            databaseOperations: 0,
            memoryUsage: 0
        };
        for (const result of results) {
            mergedResult.successfulItems.push(...result.successfulItems);
            mergedResult.failedItems.push(...result.failedItems);
            mergedResult.executionTime += result.executionTime;
            mergedResult.databaseOperations += result.databaseOperations;
            mergedResult.memoryUsage = Math.max(mergedResult.memoryUsage, result.memoryUsage);
        }
        return mergedResult;
    }
    /**
     * Get batch processing statistics
     */
    getBatchStats() {
        return {
            entityType: this.entityType,
            serviceName: this.serviceName,
            maxBatchSize: this.maxBatchSize,
            supportsBatch: this.supportsBatch,
            supportsParallel: this.supportsParallelProcessing(),
            ownership: this.ownership,
            deletionType: this.getDeletionMethod()
        };
    }
}
exports.AbstractBatchDeletionStrategy = AbstractBatchDeletionStrategy;
//# sourceMappingURL=abstractBatchDeletionStrategy.js.map