import { BatchDeletionStrategy } from '../interfaces/entity-deletion.interface';
import { BatchDeletionContext, BatchDeletionItem, BatchResult } from '../interfaces/batch-deletion.interface';
import { AbstractDeletionStrategy, DeletionType, EntityOwnership } from './abstractDeletionStrategy';
/**
 * Abstract batch deletion strategy that extends single deletion strategy
 * with batch processing capabilities
 */
export declare abstract class AbstractBatchDeletionStrategy extends AbstractDeletionStrategy implements BatchDeletionStrategy {
    readonly supportsBatch: true;
    readonly maxBatchSize: number;
    constructor(entityType: string, serviceName: string, priority?: number, version?: string, ownership?: EntityOwnership, deletionType?: DeletionType, maxBatchSize?: number);
    /**
     * Process a batch of items for deletion
     * Default implementation processes items sequentially
     * Override this method for optimized batch processing
     */
    processBatch(items: BatchDeletionItem[], context: BatchDeletionContext): Promise<BatchResult>;
    /**
     * Validate batch deletion operation
     */
    validateBatch(items: BatchDeletionItem[], context: BatchDeletionContext): Promise<{
        isValid: boolean;
        errors: string[];
    }>;
    /**
     * Custom batch validation - override in subclasses
     */
    protected validateBatchCustom(items: BatchDeletionItem[], context: BatchDeletionContext): Promise<{
        errors: string[];
    }>;
    /**
     * Estimate batch processing complexity
     */
    estimateBatchComplexity(items: BatchDeletionItem[]): Promise<number>;
    /**
     * Calculate custom complexity - override in subclasses
     */
    protected calculateCustomComplexity(items: BatchDeletionItem[]): Promise<number>;
    /**
     * Get optimal batch size for given items
     */
    getOptimalBatchSize(items: BatchDeletionItem[]): number;
    /**
     * Check if items can be processed in parallel
     */
    canProcessInParallel(items: BatchDeletionItem[]): boolean;
    /**
     * Check if strategy supports parallel processing - override in subclasses
     */
    protected supportsParallelProcessing(): boolean;
    /**
     * Prepare items for batch processing (sorting, grouping, etc.)
     */
    prepareItemsForBatch(items: BatchDeletionItem[]): BatchDeletionItem[];
    /**
     * Process batch items sequentially
     */
    protected processBatchSequentially(items: BatchDeletionItem[], context: BatchDeletionContext, batchId: string): Promise<BatchResult>;
    /**
     * Process batch items in parallel
     */
    protected processBatchInParallel(items: BatchDeletionItem[], context: BatchDeletionContext, batchId: string): Promise<BatchResult>;
    /**
     * Generate unique batch ID
     */
    protected generateBatchId(): string;
    /**
     * Create batch failure result
     */
    protected createBatchFailureResult(batchId: string, items: BatchDeletionItem[], error: string): BatchResult;
    /**
     * Log batch operation details
     */
    protected logBatchOperation(batchId: string, result: BatchResult): void;
    /**
     * Optimize batch processing based on current conditions
     */
    protected optimizeBatchProcessing(items: BatchDeletionItem[], context: BatchDeletionContext): Promise<{
        optimizedBatchSize: number;
        processingStrategy: 'sequential' | 'parallel';
        estimatedTime: number;
    }>;
    /**
     * Handle batch processing errors with retry logic
     */
    protected handleBatchError(error: Error, items: BatchDeletionItem[], context: BatchDeletionContext, retryCount?: number): Promise<BatchResult | null>;
    /**
     * Split large batches into smaller chunks
     */
    protected splitBatch(items: BatchDeletionItem[], chunkSize: number): BatchDeletionItem[][];
    /**
     * Merge multiple batch results
     */
    protected mergeBatchResults(results: BatchResult[]): BatchResult;
    /**
     * Get batch processing statistics
     */
    getBatchStats(): {
        entityType: string;
        serviceName: string;
        maxBatchSize: number;
        supportsBatch: boolean;
        supportsParallel: boolean;
        ownership: EntityOwnership;
        deletionType: DeletionType;
    };
}
//# sourceMappingURL=abstractBatchDeletionStrategy.d.ts.map