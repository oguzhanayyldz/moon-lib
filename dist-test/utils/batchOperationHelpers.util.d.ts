import { BatchDeletionItem, BatchResult, ResourceUsage } from '../common/interfaces/batch-deletion.interface';
/**
 * Batch operation helper utilities
 */
export declare class BatchOperationHelpers {
    /**
     * Split large arrays into smaller batches
     */
    static splitIntoBatches<T>(items: T[], batchSize: number): T[][];
    /**
     * Merge multiple batch results into a single result
     */
    static mergeBatchResults(results: BatchResult[]): BatchResult;
    /**
     * Calculate optimal batch size based on system resources
     */
    static calculateOptimalBatchSize(totalItems: number, maxBatchSize?: number, memoryConstraint?: number): number;
    /**
     * Group batch items by entity type
     */
    static groupByEntityType(items: BatchDeletionItem[]): Map<string, BatchDeletionItem[]>;
    /**
     * Sort items by priority and dependencies
     */
    static sortItemsByPriorityAndDependencies(items: BatchDeletionItem[]): BatchDeletionItem[];
    /**
     * Perform topological sort on items with dependencies
     */
    private static topologicalSort;
    /**
     * Validate batch items for consistency
     */
    static validateBatchItems(items: BatchDeletionItem[]): {
        isValid: boolean;
        errors: string[];
        warnings: string[];
    };
    /**
     * Estimate batch processing time
     */
    static estimateBatchProcessingTime(items: BatchDeletionItem[], averageItemProcessingTime?: number, // milliseconds
    parallelProcessing?: boolean, maxConcurrency?: number): number;
    /**
     * Calculate complexity factor for items
     */
    private static calculateComplexityFactor;
    /**
     * Create batch deletion items from entity IDs
     */
    static createBatchItems(entityIds: string[], entityType: string, options?: {
        priority?: number;
        metadata?: Record<string, any>;
        dependencies?: string[];
    }): BatchDeletionItem[];
    /**
     * Filter items by criteria
     */
    static filterItems(items: BatchDeletionItem[], criteria: {
        entityTypes?: string[];
        minPriority?: number;
        maxPriority?: number;
        hasDependencies?: boolean;
        hasMetadata?: boolean;
    }): BatchDeletionItem[];
    /**
     * Analyze batch composition
     */
    static analyzeBatchComposition(items: BatchDeletionItem[]): {
        totalItems: number;
        entityTypes: {
            [type: string]: number;
        };
        priorityDistribution: {
            [priority: number]: number;
        };
        itemsWithDependencies: number;
        itemsWithMetadata: number;
        averagePriority: number;
        complexityScore: number;
    };
    /**
     * Generate batch processing recommendations
     */
    static generateBatchRecommendations(items: BatchDeletionItem[]): {
        recommendedBatchSize: number;
        recommendedConcurrency: number;
        processingStrategy: 'sequential' | 'parallel';
        estimatedTime: number;
        warnings: string[];
        optimizations: string[];
    };
}
/**
 * Resource management utilities
 */
export declare class ResourceManager {
    private static memoryThreshold;
    private static cpuThreshold;
    /**
     * Check if system resources are sufficient for batch processing
     */
    static checkResourceAvailability(): {
        sufficient: boolean;
        memoryStatus: 'ok' | 'warning' | 'critical';
        cpuStatus: 'ok' | 'warning' | 'critical';
        recommendations: string[];
    };
    /**
     * Calculate optimal resource allocation
     */
    static calculateOptimalAllocation(totalItems: number, itemComplexity?: number): {
        maxBatchSize: number;
        maxConcurrency: number;
        memoryPerBatch: number;
        recommendedDelay: number;
    };
    /**
     * Monitor resource usage during batch processing
     */
    static createResourceMonitor(interval?: number): {
        start: () => void;
        stop: () => void;
        getReport: () => ResourceUsage[];
    };
    /**
     * Calculate resource efficiency metrics
     */
    static calculateEfficiencyMetrics(usageHistory: ResourceUsage[], batchResults: BatchResult[]): {
        averageMemoryUsage: number;
        peakMemoryUsage: number;
        memoryEfficiency: number;
        throughput: number;
        resourceUtilization: number;
    };
    /**
     * Set resource thresholds
     */
    static setThresholds(memoryThreshold: number, cpuThreshold: number): void;
    /**
     * Get current thresholds
     */
    static getThresholds(): {
        memory: number;
        cpu: number;
    };
}
//# sourceMappingURL=batchOperationHelpers.util.d.ts.map