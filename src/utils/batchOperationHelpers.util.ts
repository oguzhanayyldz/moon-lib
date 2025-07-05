import { 
  BatchDeletionItem, 
  BatchDeletionContext, 
  BatchResult, 
  ResourceUsage 
} from '../common/interfaces/batch-deletion.interface';
import { performanceMonitor } from './performanceMonitor.util';
import { logger } from '../services/logger.service';

/**
 * Batch operation helper utilities
 */
export class BatchOperationHelpers {
  
  /**
   * Split large arrays into smaller batches
   */
  public static splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
    if (batchSize <= 0) {
      throw new Error('Batch size must be greater than 0');
    }

    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    return batches;
  }

  /**
   * Merge multiple batch results into a single result
   */
  public static mergeBatchResults(results: BatchResult[]): BatchResult {
    if (results.length === 0) {
      return {
        batchId: 'empty_merge',
        successfulItems: [],
        failedItems: [],
        executionTime: 0,
        databaseOperations: 0,
        memoryUsage: 0
      };
    }

    if (results.length === 1) {
      return results[0];
    }

    const merged: BatchResult = {
      batchId: `merged_${Date.now()}`,
      successfulItems: [],
      failedItems: [],
      executionTime: 0,
      databaseOperations: 0,
      memoryUsage: 0
    };

    for (const result of results) {
      merged.successfulItems.push(...result.successfulItems);
      merged.failedItems.push(...result.failedItems);
      merged.executionTime += result.executionTime;
      merged.databaseOperations += result.databaseOperations;
      merged.memoryUsage = Math.max(merged.memoryUsage, result.memoryUsage);
    }

    return merged;
  }

  /**
   * Calculate optimal batch size based on system resources
   */
  public static calculateOptimalBatchSize(
    totalItems: number,
    maxBatchSize: number = 1000,
    memoryConstraint: number = 512 // MB
  ): number {
    const currentMemory = performanceMonitor.getCurrentResourceUsage().memoryUsage;
    const availableMemory = Math.max(0, memoryConstraint - currentMemory);
    
    // Reduce batch size if memory is constrained
    let adjustedBatchSize = maxBatchSize;
    if (availableMemory < 100) { // Less than 100MB available
      adjustedBatchSize = Math.floor(maxBatchSize * 0.3);
    } else if (availableMemory < 200) { // Less than 200MB available
      adjustedBatchSize = Math.floor(maxBatchSize * 0.6);
    }
    
    // Ensure minimum batch size
    adjustedBatchSize = Math.max(10, adjustedBatchSize);
    
    // Don't exceed total items
    return Math.min(adjustedBatchSize, totalItems);
  }

  /**
   * Group batch items by entity type
   */
  public static groupByEntityType(items: BatchDeletionItem[]): Map<string, BatchDeletionItem[]> {
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
   * Sort items by priority and dependencies
   */
  public static sortItemsByPriorityAndDependencies(items: BatchDeletionItem[]): BatchDeletionItem[] {
    // Create a map of entity IDs for quick lookup
    const entityIdSet = new Set(items.map(item => item.entityId));
    
    // Separate items with and without dependencies
    const itemsWithDependencies = items.filter(item => 
      item.dependencies && item.dependencies.length > 0
    );
    const itemsWithoutDependencies = items.filter(item => 
      !item.dependencies || item.dependencies.length === 0
    );
    
    // Sort items without dependencies by priority
    itemsWithoutDependencies.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    // Topological sort for items with dependencies
    const sortedWithDependencies = this.topologicalSort(itemsWithDependencies, entityIdSet);
    
    // Combine sorted arrays
    return [...sortedWithDependencies, ...itemsWithoutDependencies];
  }

  /**
   * Perform topological sort on items with dependencies
   */
  private static topologicalSort(items: BatchDeletionItem[], entityIdSet: Set<string>): BatchDeletionItem[] {
    const result: BatchDeletionItem[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    const visit = (item: BatchDeletionItem): void => {
      if (visiting.has(item.entityId)) {
        throw new Error(`Circular dependency detected for entity: ${item.entityId}`);
      }
      
      if (visited.has(item.entityId)) {
        return;
      }
      
      visiting.add(item.entityId);
      
      // Visit dependencies first
      if (item.dependencies) {
        for (const dependencyId of item.dependencies) {
          // Only consider dependencies that are in our batch
          if (entityIdSet.has(dependencyId)) {
            const dependencyItem = items.find(i => i.entityId === dependencyId);
            if (dependencyItem) {
              visit(dependencyItem);
            }
          }
        }
      }
      
      visiting.delete(item.entityId);
      visited.add(item.entityId);
      result.push(item);
    };
    
    // Sort by priority first
    const sortedByPriority = [...items].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    for (const item of sortedByPriority) {
      if (!visited.has(item.entityId)) {
        visit(item);
      }
    }
    
    return result;
  }

  /**
   * Validate batch items for consistency
   */
  public static validateBatchItems(items: BatchDeletionItem[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const entityIds = new Set<string>();
    const duplicateIds = new Set<string>();
    
    for (const item of items) {
      // Check for required fields
      if (!item.entityId) {
        errors.push('Item missing required entityId');
        continue;
      }
      
      if (!item.entityType) {
        errors.push(`Item ${item.entityId} missing required entityType`);
        continue;
      }
      
      // Check for duplicates
      if (entityIds.has(item.entityId)) {
        duplicateIds.add(item.entityId);
        errors.push(`Duplicate entity ID found: ${item.entityId}`);
      } else {
        entityIds.add(item.entityId);
      }
      
      // Check dependencies
      if (item.dependencies) {
        for (const dependency of item.dependencies) {
          if (dependency === item.entityId) {
            errors.push(`Self-dependency detected for entity: ${item.entityId}`);
          }
        }
      }
      
      // Check priority range
      if (item.priority !== undefined && (item.priority < 0 || item.priority > 10)) {
        warnings.push(`Priority for ${item.entityId} is outside recommended range (0-10)`);
      }
    }
    
    // Check for unresolved dependencies
    for (const item of items) {
      if (item.dependencies) {
        for (const dependency of item.dependencies) {
          if (!entityIds.has(dependency)) {
            warnings.push(`Unresolved dependency ${dependency} for entity ${item.entityId}`);
          }
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Estimate batch processing time
   */
  public static estimateBatchProcessingTime(
    items: BatchDeletionItem[],
    averageItemProcessingTime: number = 100, // milliseconds
    parallelProcessing: boolean = true,
    maxConcurrency: number = 5
  ): number {
    if (items.length === 0) {
      return 0;
    }
    
    // Calculate complexity factor
    const complexityFactor = this.calculateComplexityFactor(items);
    const adjustedProcessingTime = averageItemProcessingTime * complexityFactor;
    
    if (parallelProcessing && items.length > 1) {
      // Parallel processing estimation
      const batches = Math.ceil(items.length / maxConcurrency);
      return batches * adjustedProcessingTime;
    } else {
      // Sequential processing
      return items.length * adjustedProcessingTime;
    }
  }

  /**
   * Calculate complexity factor for items
   */
  private static calculateComplexityFactor(items: BatchDeletionItem[]): number {
    let complexityScore = 0;
    
    for (const item of items) {
      let itemComplexity = 1;
      
      // Add complexity for dependencies
      if (item.dependencies && item.dependencies.length > 0) {
        itemComplexity += item.dependencies.length * 0.5;
      }
      
      // Add complexity for metadata
      if (item.metadata && Object.keys(item.metadata).length > 0) {
        itemComplexity += 0.2;
      }
      
      complexityScore += itemComplexity;
    }
    
    return complexityScore / items.length;
  }

  /**
   * Create batch deletion items from entity IDs
   */
  public static createBatchItems(
    entityIds: string[],
    entityType: string,
    options: {
      priority?: number;
      metadata?: Record<string, any>;
      dependencies?: string[];
    } = {}
  ): BatchDeletionItem[] {
    return entityIds.map(entityId => ({
      entityId,
      entityType,
      priority: options.priority,
      metadata: options.metadata,
      dependencies: options.dependencies
    }));
  }

  /**
   * Filter items by criteria
   */
  public static filterItems(
    items: BatchDeletionItem[],
    criteria: {
      entityTypes?: string[];
      minPriority?: number;
      maxPriority?: number;
      hasDependencies?: boolean;
      hasMetadata?: boolean;
    }
  ): BatchDeletionItem[] {
    return items.filter(item => {
      // Filter by entity types
      if (criteria.entityTypes && !criteria.entityTypes.includes(item.entityType)) {
        return false;
      }
      
      // Filter by priority range
      const priority = item.priority || 0;
      if (criteria.minPriority !== undefined && priority < criteria.minPriority) {
        return false;
      }
      if (criteria.maxPriority !== undefined && priority > criteria.maxPriority) {
        return false;
      }
      
      // Filter by dependencies
      if (criteria.hasDependencies !== undefined) {
        const hasDeps = Boolean(item.dependencies && item.dependencies.length > 0);
        if (criteria.hasDependencies !== hasDeps) {
          return false;
        }
      }
      
      // Filter by metadata
      if (criteria.hasMetadata !== undefined) {
        const hasMeta = Boolean(item.metadata && Object.keys(item.metadata).length > 0);
        if (criteria.hasMetadata !== hasMeta) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Analyze batch composition
   */
  public static analyzeBatchComposition(items: BatchDeletionItem[]): {
    totalItems: number;
    entityTypes: { [type: string]: number };
    priorityDistribution: { [priority: number]: number };
    itemsWithDependencies: number;
    itemsWithMetadata: number;
    averagePriority: number;
    complexityScore: number;
  } {
    const analysis = {
      totalItems: items.length,
      entityTypes: {} as { [type: string]: number },
      priorityDistribution: {} as { [priority: number]: number },
      itemsWithDependencies: 0,
      itemsWithMetadata: 0,
      averagePriority: 0,
      complexityScore: 0
    };
    
    let totalPriority = 0;
    
    for (const item of items) {
      // Count entity types
      analysis.entityTypes[item.entityType] = (analysis.entityTypes[item.entityType] || 0) + 1;
      
      // Count priority distribution
      const priority = item.priority || 0;
      analysis.priorityDistribution[priority] = (analysis.priorityDistribution[priority] || 0) + 1;
      totalPriority += priority;
      
      // Count items with dependencies
      if (item.dependencies && item.dependencies.length > 0) {
        analysis.itemsWithDependencies++;
      }
      
      // Count items with metadata
      if (item.metadata && Object.keys(item.metadata).length > 0) {
        analysis.itemsWithMetadata++;
      }
    }
    
    analysis.averagePriority = items.length > 0 ? totalPriority / items.length : 0;
    analysis.complexityScore = this.calculateComplexityFactor(items);
    
    return analysis;
  }

  /**
   * Generate batch processing recommendations
   */
  public static generateBatchRecommendations(items: BatchDeletionItem[]): {
    recommendedBatchSize: number;
    recommendedConcurrency: number;
    processingStrategy: 'sequential' | 'parallel';
    estimatedTime: number;
    warnings: string[];
    optimizations: string[];
  } {
    const analysis = this.analyzeBatchComposition(items);
    const warnings: string[] = [];
    const optimizations: string[] = [];
    
    // Calculate recommended batch size
    let recommendedBatchSize = this.calculateOptimalBatchSize(items.length);
    
    // Adjust for complexity
    if (analysis.complexityScore > 2) {
      recommendedBatchSize = Math.floor(recommendedBatchSize * 0.7);
      warnings.push('High complexity detected, reducing batch size');
    }
    
    // Determine concurrency
    let recommendedConcurrency = 3;
    if (analysis.itemsWithDependencies > items.length * 0.5) {
      recommendedConcurrency = 1;
      warnings.push('Many dependencies detected, sequential processing recommended');
    } else if (analysis.complexityScore < 1.5) {
      recommendedConcurrency = 5;
      optimizations.push('Low complexity, can increase concurrency');
    }
    
    // Determine processing strategy
    const processingStrategy = analysis.itemsWithDependencies > 0 ? 'sequential' : 'parallel';
    
    // Estimate time
    const estimatedTime = this.estimateBatchProcessingTime(
      items,
      100,
      processingStrategy === 'parallel',
      recommendedConcurrency
    );
    
    // Additional optimizations
    if (Object.keys(analysis.entityTypes).length === 1) {
      optimizations.push('Single entity type detected, can use optimized processing');
    }
    
    if (analysis.itemsWithMetadata === 0) {
      optimizations.push('No metadata detected, can use simplified processing');
    }
    
    return {
      recommendedBatchSize,
      recommendedConcurrency,
      processingStrategy,
      estimatedTime,
      warnings,
      optimizations
    };
  }
}

/**
 * Resource management utilities
 */
export class ResourceManager {
  private static memoryThreshold = 512; // MB
  private static cpuThreshold = 80; // percentage
  
  /**
   * Check if system resources are sufficient for batch processing
   */
  public static checkResourceAvailability(): {
    sufficient: boolean;
    memoryStatus: 'ok' | 'warning' | 'critical';
    cpuStatus: 'ok' | 'warning' | 'critical';
    recommendations: string[];
  } {
    const resourceUsage = performanceMonitor.getCurrentResourceUsage();
    const recommendations: string[] = [];
    
    // Check memory status
    let memoryStatus: 'ok' | 'warning' | 'critical' = 'ok';
    if (resourceUsage.memoryUsage > this.memoryThreshold * 0.9) {
      memoryStatus = 'critical';
      recommendations.push('Memory usage critical, defer batch processing');
    } else if (resourceUsage.memoryUsage > this.memoryThreshold * 0.8) {
      memoryStatus = 'warning';
      recommendations.push('Memory usage high, reduce batch size');
    }
    
    // Check CPU status (simplified - would need more sophisticated monitoring)
    let cpuStatus: 'ok' | 'warning' | 'critical' = 'ok';
    // CPU monitoring would be implemented here
    
    const sufficient = (memoryStatus as string) !== 'critical' && (cpuStatus as string) !== 'critical';
    
    return {
      sufficient,
      memoryStatus,
      cpuStatus,
      recommendations
    };
  }

  /**
   * Calculate optimal resource allocation
   */
  public static calculateOptimalAllocation(
    totalItems: number,
    itemComplexity: number = 1
  ): {
    maxBatchSize: number;
    maxConcurrency: number;
    memoryPerBatch: number;
    recommendedDelay: number;
  } {
    const resourceUsage = performanceMonitor.getCurrentResourceUsage();
    const availableMemory = Math.max(0, this.memoryThreshold - resourceUsage.memoryUsage);
    
    // Estimate memory per item (simplified)
    const memoryPerItem = 0.1 * itemComplexity; // MB per item
    const maxItemsForMemory = Math.floor(availableMemory / memoryPerItem);
    
    const maxBatchSize = Math.min(maxItemsForMemory, 1000);
    const maxConcurrency = Math.min(Math.floor(availableMemory / 50), 5); // Rough estimate
    const memoryPerBatch = maxBatchSize * memoryPerItem;
    const recommendedDelay = resourceUsage.memoryUsage > this.memoryThreshold * 0.7 ? 1000 : 100;
    
    return {
      maxBatchSize,
      maxConcurrency,
      memoryPerBatch,
      recommendedDelay
    };
  }

  /**
   * Monitor resource usage during batch processing
   */
  public static createResourceMonitor(interval: number = 5000): {
    start: () => void;
    stop: () => void;
    getReport: () => ResourceUsage[];
  } {
    let monitoringInterval: NodeJS.Timeout | null = null;
    const usageHistory: ResourceUsage[] = [];
    
    const start = () => {
      if (monitoringInterval) return;
      
      monitoringInterval = setInterval(() => {
        const usage = performanceMonitor.getCurrentResourceUsage();
        usageHistory.push(usage);
        
        // Keep only last 100 entries
        if (usageHistory.length > 100) {
          usageHistory.shift();
        }
        
        // Check for resource exhaustion
        if (usage.memoryUsage > this.memoryThreshold * 0.95) {
          logger.warn('Memory usage approaching critical level', {
            current: usage.memoryUsage,
            threshold: this.memoryThreshold
          });
        }
      }, interval);
    };
    
    const stop = () => {
      if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
      }
    };
    
    const getReport = () => [...usageHistory];
    
    return { start, stop, getReport };
  }

  /**
   * Calculate resource efficiency metrics
   */
  public static calculateEfficiencyMetrics(
    usageHistory: ResourceUsage[],
    batchResults: BatchResult[]
  ): {
    averageMemoryUsage: number;
    peakMemoryUsage: number;
    memoryEfficiency: number;
    throughput: number; // items per second
    resourceUtilization: number;
  } {
    if (usageHistory.length === 0 || batchResults.length === 0) {
      return {
        averageMemoryUsage: 0,
        peakMemoryUsage: 0,
        memoryEfficiency: 0,
        throughput: 0,
        resourceUtilization: 0
      };
    }
    
    const totalMemory = usageHistory.reduce((sum, usage) => sum + usage.memoryUsage, 0);
    const averageMemoryUsage = totalMemory / usageHistory.length;
    const peakMemoryUsage = Math.max(...usageHistory.map(usage => usage.memoryUsage));
    
    const totalItems = batchResults.reduce((sum, result) => 
      sum + result.successfulItems.length + result.failedItems.length, 0
    );
    const totalTime = batchResults.reduce((sum, result) => sum + result.executionTime, 0);
    const throughput = totalTime > 0 ? (totalItems / totalTime) * 1000 : 0; // items per second
    
    // Simple efficiency calculation
    const memoryEfficiency = peakMemoryUsage > 0 ? (totalItems / peakMemoryUsage) : 0;
    const resourceUtilization = (averageMemoryUsage / this.memoryThreshold) * 100;
    
    return {
      averageMemoryUsage,
      peakMemoryUsage,
      memoryEfficiency,
      throughput,
      resourceUtilization
    };
  }

  /**
   * Set resource thresholds
   */
  public static setThresholds(memoryThreshold: number, cpuThreshold: number): void {
    this.memoryThreshold = memoryThreshold;
    this.cpuThreshold = cpuThreshold;
    
    logger.info('Resource thresholds updated', {
      memoryThreshold,
      cpuThreshold
    });
  }

  /**
   * Get current thresholds
   */
  public static getThresholds(): { memory: number; cpu: number } {
    return {
      memory: this.memoryThreshold,
      cpu: this.cpuThreshold
    };
  }
}