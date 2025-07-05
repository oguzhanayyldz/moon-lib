# Batch Deletion System Documentation

## Overview

The Batch Deletion System in moon-lib provides comprehensive batch processing capabilities for entity deletion operations with performance optimizations, caching, parallel processing, and resource management.

## Architecture Components

### 1. Core Interfaces

#### BatchDeletionItem
Represents a single entity to be deleted in a batch operation:
```typescript
interface BatchDeletionItem {
  entityType: string;
  entityId: string;
  metadata?: Record<string, any>;
  priority?: number;
  dependencies?: string[];
}
```

#### BatchDeletionContext
Context for batch deletion operations:
```typescript
interface BatchDeletionContext {
  items: BatchDeletionItem[];
  userId?: string;
  requestId?: string;
  transaction?: ClientSession;
  config?: BatchDeletionConfig;
  // ... additional properties
}
```

#### BatchDeletionResult
Result of batch deletion operations:
```typescript
interface BatchDeletionResult {
  success: boolean;
  batchResults: BatchResult[];
  metrics: BatchPerformanceMetrics;
  affectedServices: string[];
  error?: string;
  errors?: Array<{
    entityId: string;
    entityType: string;
    error: string;
    batchId: string;
  }>;
}
```

### 2. Enhanced Entity Deletion Registry

The `EnhancedEntityDeletionRegistry` extends the basic registry with:

- **Batch Operations**: Process multiple entities in optimized batches
- **Performance Monitoring**: Track metrics and resource usage
- **Strategy Caching**: Cache strategy resolution for better performance
- **Connection Pooling**: Optimize database connections
- **Parallel Processing**: Process independent items concurrently

#### Key Features

```typescript
// Single entity deletion
const result = await registry.execute({
  entityType: 'product',
  entityId: 'prod-123',
  userId: 'user-456'
});

// Batch entity deletion
const batchResult = await registry.executeBatch({
  items: [
    { entityId: 'prod-1', entityType: 'product' },
    { entityId: 'prod-2', entityType: 'product' },
    { entityId: 'user-1', entityType: 'user' }
  ],
  userId: 'admin-user',
  config: {
    batchSize: 50,
    maxConcurrentBatches: 3,
    useBulkOperations: true
  }
});
```

### 3. Abstract Batch Deletion Strategy

The `AbstractBatchDeletionStrategy` provides a base class for implementing batch-aware deletion strategies:

```typescript
class ProductBatchDeletionStrategy extends AbstractBatchDeletionStrategy {
  constructor() {
    super('product', 'product-service', 1, '1.0.0', EntityOwnership.NATIVE, DeletionType.SOFT, 100);
  }

  async execute(context: DeletionContext): Promise<DeletionResult> {
    // Implement single item deletion logic
    return {
      success: true,
      deletedEntities: [context.entityId],
      affectedServices: [this.serviceName]
    };
  }

  // Batch processing is automatically handled by the base class
  // Override processBatch() for custom batch logic
}
```

### 4. Batch Processing Engine

The `BatchProcessingEngine` handles the core batch processing logic:

- **Connection Pooling**: Manages database connections efficiently
- **Queue Management**: Handles batch queuing and processing order
- **Memory Management**: Monitors and controls memory usage
- **Performance Optimization**: Optimizes batch sizes and concurrency

#### Configuration

```typescript
const engine = new BatchProcessingEngine({
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
    enableCompression: false
  }
});
```

### 5. Performance Monitoring

The `PerformanceMonitor` provides comprehensive monitoring capabilities:

```typescript
// Start monitoring
performanceMonitor.startMonitoring();

// Get current resource usage
const resourceUsage = performanceMonitor.getCurrentResourceUsage();
console.log(`Memory usage: ${resourceUsage.memoryUsage}MB`);

// Get performance trends
const memoryTrend = performanceMonitor.getResourceUsageTrend('memoryUsage', 5);
console.log(`Memory trend: ${memoryTrend.trend}, change: ${memoryTrend.change}%`);

// Export metrics
const prometheusMetrics = performanceMonitor.exportMetrics('prometheus');
```

### 6. Strategy Caching

The `StrategyCacheService` provides intelligent caching for strategy resolution:

```typescript
// Strategies are automatically cached when resolved
const strategy = registry.resolve('product'); // Cache miss
const strategy2 = registry.resolve('product'); // Cache hit

// Manual cache management
strategyCacheService.set('custom-entity', customStrategy);
const cached = strategyCacheService.get('custom-entity');

// Cache statistics
const stats = strategyCacheService.getStats();
console.log(`Cache hit rate: ${stats.hitRate}%`);

// Performance report
const report = strategyCacheService.getPerformanceReport();
```

### 7. Batch Operation Helpers

The `BatchOperationHelpers` utility provides various helper functions:

```typescript
// Split items into batches
const batches = BatchOperationHelpers.splitIntoBatches(items, 50);

// Group items by entity type
const groups = BatchOperationHelpers.groupByEntityType(items);

// Sort items by priority and dependencies
const sorted = BatchOperationHelpers.sortItemsByPriorityAndDependencies(items);

// Validate batch items
const validation = BatchOperationHelpers.validateBatchItems(items);

// Analyze batch composition
const analysis = BatchOperationHelpers.analyzeBatchComposition(items);

// Generate recommendations
const recommendations = BatchOperationHelpers.generateBatchRecommendations(items);
```

### 8. Resource Management

The `ResourceManager` helps manage system resources during batch operations:

```typescript
// Check resource availability
const availability = ResourceManager.checkResourceAvailability();
if (!availability.sufficient) {
  console.log('Resources insufficient:', availability.recommendations);
}

// Calculate optimal allocation
const allocation = ResourceManager.calculateOptimalAllocation(1000, 1.5);
console.log(`Optimal batch size: ${allocation.maxBatchSize}`);

// Monitor resource usage during processing
const monitor = ResourceManager.createResourceMonitor(5000);
monitor.start();
// ... perform batch operations
monitor.stop();
const report = monitor.getReport();
```

## Usage Examples

### Basic Batch Deletion

```typescript
import { 
  enhancedEntityDeletionRegistry,
  BatchDeletionContext,
  BatchDeletionItem 
} from '@xmoonx/moon-lib';

// Register your strategies
enhancedEntityDeletionRegistry.register(new ProductDeletionStrategy());
enhancedEntityDeletionRegistry.register(new UserDeletionStrategy());

// Prepare batch items
const items: BatchDeletionItem[] = [
  { entityId: 'prod-1', entityType: 'product', priority: 5 },
  { entityId: 'prod-2', entityType: 'product', priority: 3 },
  { entityId: 'user-1', entityType: 'user', priority: 8 }
];

// Execute batch deletion
const context: BatchDeletionContext = {
  items,
  userId: 'admin-user',
  requestId: 'batch-delete-001',
  config: {
    batchSize: 10,
    maxConcurrentBatches: 3,
    useBulkOperations: true,
    enablePerformanceMonitoring: true
  }
};

const result = await enhancedEntityDeletionRegistry.executeBatch(context);

if (result.success) {
  console.log(`Successfully deleted ${result.metrics.successfulDeletions} items`);
  console.log(`Processing time: ${result.metrics.totalExecutionTime}ms`);
} else {
  console.error('Batch deletion failed:', result.error);
  result.errors?.forEach(error => {
    console.error(`Failed to delete ${error.entityId}: ${error.error}`);
  });
}
```

### Advanced Batch Processing with Dependencies

```typescript
import { BatchOperationHelpers } from '@xmoonx/moon-lib';

// Items with dependencies
const itemsWithDeps: BatchDeletionItem[] = [
  { entityId: 'order-1', entityType: 'order' },
  { entityId: 'payment-1', entityType: 'payment', dependencies: ['order-1'] },
  { entityId: 'invoice-1', entityType: 'invoice', dependencies: ['order-1', 'payment-1'] }
];

// Validate and sort items
const validation = BatchOperationHelpers.validateBatchItems(itemsWithDeps);
if (!validation.isValid) {
  console.error('Validation errors:', validation.errors);
  return;
}

const sortedItems = BatchOperationHelpers.sortItemsByPriorityAndDependencies(itemsWithDeps);

// Execute with proper dependency order
const result = await enhancedEntityDeletionRegistry.executeBatch({
  items: sortedItems,
  userId: 'admin-user',
  config: {
    maxConcurrentBatches: 1, // Sequential processing for dependencies
    continueOnBatchFailure: false
  }
});
```

### Performance Monitoring and Optimization

```typescript
import { performanceMonitor, ResourceManager } from '@xmoonx/moon-lib';

// Start monitoring
performanceMonitor.startMonitoring();

// Check resources before processing
const availability = ResourceManager.checkResourceAvailability();
if (!availability.sufficient) {
  console.warn('System resources low:', availability.recommendations);
}

// Calculate optimal settings
const allocation = ResourceManager.calculateOptimalAllocation(items.length, 2.0);

// Execute with optimized settings
const result = await enhancedEntityDeletionRegistry.executeBatch({
  items,
  userId: 'admin-user',
  config: {
    batchSize: allocation.maxBatchSize,
    maxConcurrentBatches: allocation.maxConcurrency,
    batchDelay: allocation.recommendedDelay
  }
});

// Get performance report
const report = enhancedEntityDeletionRegistry.getPerformanceReport();
console.log('Performance Report:', report);

// Export metrics for external monitoring
const metrics = performanceMonitor.exportMetrics('prometheus');
```

### Custom Batch Strategy Implementation

```typescript
import { AbstractBatchDeletionStrategy, DeletionType, EntityOwnership } from '@xmoonx/moon-lib';

class CustomBatchDeletionStrategy extends AbstractBatchDeletionStrategy {
  constructor() {
    super('custom-entity', 'custom-service', 1, '1.0.0', EntityOwnership.NATIVE, DeletionType.SOFT, 200);
  }

  async execute(context: DeletionContext): Promise<DeletionResult> {
    // Single item deletion logic
    try {
      await this.deleteFromDatabase(context.entityId);
      await this.publishDeletionEvent(context);
      
      return this.createSuccessResult([context.entityId]);
    } catch (error) {
      return this.createFailureResult(error.message);
    }
  }

  // Override batch processing for custom optimization
  async processBatch(items: BatchDeletionItem[], context: BatchDeletionContext): Promise<BatchResult> {
    // Custom bulk deletion logic
    const entityIds = items.map(item => item.entityId);
    
    try {
      await this.bulkDeleteFromDatabase(entityIds);
      await this.publishBulkDeletionEvents(entityIds, context);
      
      return {
        batchId: this.generateBatchId(),
        successfulItems: entityIds,
        failedItems: [],
        executionTime: 0, // Will be set by framework
        databaseOperations: 1, // Single bulk operation
        memoryUsage: performanceMonitor.getCurrentResourceUsage().memoryUsage
      };
    } catch (error) {
      return this.createBatchFailureResult(this.generateBatchId(), items, error.message);
    }
  }

  // Custom validation for batch operations
  protected async validateBatchCustom(
    items: BatchDeletionItem[],
    context: BatchDeletionContext
  ): Promise<{ errors: string[] }> {
    const errors: string[] = [];
    
    // Custom validation logic
    const uniqueEntityIds = new Set(items.map(item => item.entityId));
    if (uniqueEntityIds.size !== items.length) {
      errors.push('Duplicate entity IDs detected in batch');
    }
    
    return { errors };
  }

  private async deleteFromDatabase(entityId: string): Promise<void> {
    // Implementation specific to your database
  }

  private async bulkDeleteFromDatabase(entityIds: string[]): Promise<void> {
    // Bulk deletion implementation
  }

  private async publishDeletionEvent(context: DeletionContext): Promise<void> {
    // Event publishing logic
  }

  private async publishBulkDeletionEvents(entityIds: string[], context: BatchDeletionContext): Promise<void> {
    // Bulk event publishing logic
  }
}

// Register the custom strategy
enhancedEntityDeletionRegistry.register(new CustomBatchDeletionStrategy());
```

## Configuration Options

### Batch Deletion Config

```typescript
interface BatchDeletionConfig {
  batchSize?: number;                    // Default: 50
  maxConcurrentBatches?: number;         // Default: 3
  batchTimeout?: number;                 // Default: 60000ms
  continueOnBatchFailure?: boolean;      // Default: true
  useBulkOperations?: boolean;           // Default: true
  memoryThreshold?: number;              // Default: 512MB
  enablePerformanceMonitoring?: boolean; // Default: true
  enableConnectionPooling?: boolean;     // Default: true
  batchDelay?: number;                   // Default: 100ms
}
```

### Performance Optimization Config

```typescript
interface PerformanceOptimizationConfig {
  enableQueryOptimization?: boolean;    // Default: true
  enableIndexHints?: boolean;           // Default: true
  enableResultCaching?: boolean;        // Default: true
  cacheTtl?: number;                    // Default: 300s
  enableCompression?: boolean;          // Default: false
  compressionAlgorithm?: 'gzip' | 'lz4' | 'snappy'; // Default: 'gzip'
}
```

## Best Practices

### 1. Batch Size Optimization
- Start with small batch sizes (10-50 items) and increase based on performance
- Consider memory constraints and item complexity
- Use `BatchOperationHelpers.calculateOptimalBatchSize()` for automatic optimization

### 2. Dependency Management
- Always validate dependencies before processing
- Use topological sorting for complex dependency chains
- Consider sequential processing for dependent items

### 3. Error Handling
- Implement proper rollback mechanisms for critical operations
- Use `continueOnBatchFailure: false` for operations requiring all-or-nothing semantics
- Log detailed error information for debugging

### 4. Performance Monitoring
- Enable performance monitoring in production
- Set up alerts for resource thresholds
- Regularly review performance reports and optimize accordingly

### 5. Resource Management
- Monitor memory usage during large batch operations
- Use connection pooling for database-heavy operations
- Implement back-pressure mechanisms for high-load scenarios

### 6. Strategy Design
- Implement both single and batch processing methods
- Use bulk operations when possible for better performance
- Cache frequently accessed data within strategies

## Troubleshooting

### Common Issues

1. **Memory Exhaustion**
   - Reduce batch size
   - Enable garbage collection optimization
   - Increase memory threshold action sensitivity

2. **Performance Degradation**
   - Check cache hit rates
   - Verify optimal batch sizes
   - Monitor database connection usage

3. **Dependency Conflicts**
   - Validate dependency chains
   - Use sequential processing for complex dependencies
   - Check for circular dependencies

4. **Transaction Failures**
   - Implement proper retry mechanisms
   - Use shorter transaction timeouts
   - Consider breaking large transactions into smaller ones

### Debugging Tools

```typescript
// Enable detailed logging
const context: BatchDeletionContext = {
  items,
  config: { enableDetailedLogging: true }
};

// Get detailed performance report
const report = enhancedEntityDeletionRegistry.getPerformanceReport();

// Monitor resource usage in real-time
const monitor = ResourceManager.createResourceMonitor(1000);
monitor.start();

// Check strategy cache performance
const cacheReport = strategyCacheService.getPerformanceReport();
```

## Migration Guide

### From Basic to Enhanced Registry

```typescript
// Old usage
import { entityDeletionRegistry } from '@xmoonx/moon-lib';

// New usage
import { enhancedEntityDeletionRegistry } from '@xmoonx/moon-lib';

// The API is backward compatible for single deletions
const result = await enhancedEntityDeletionRegistry.execute(context);

// New batch capabilities
const batchResult = await enhancedEntityDeletionRegistry.executeBatch(batchContext);
```

### Upgrading Existing Strategies

```typescript
// Old strategy
class OldStrategy implements EntityDeletionStrategy {
  // ... existing implementation
}

// New batch-aware strategy
class NewStrategy extends AbstractBatchDeletionStrategy {
  // Inherit existing functionality and add batch capabilities
  async execute(context: DeletionContext): Promise<DeletionResult> {
    // Keep existing single-item logic
  }
  
  // Batch processing is automatically available
}
```

This comprehensive batch deletion system provides scalable, performant, and reliable entity deletion capabilities with extensive monitoring, optimization, and management features.