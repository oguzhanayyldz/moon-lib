import { 
  BatchDeletionItem, 
  BatchDeletionContext, 
  BatchDeletionConfig,
  BatchResult,
  BatchDeletionResult
} from '../common/interfaces/batch-deletion.interface';
import { 
  DeletionContext, 
  DeletionResult, 
  EntityDeletionStrategy,
  DeletionValidationResult
} from '../common/interfaces/entity-deletion.interface';
import { AbstractBatchDeletionStrategy } from '../common/strategies/abstractBatchDeletionStrategy';
import { EnhancedEntityDeletionRegistry } from '../services/enhancedEntityDeletionRegistry';
import { BatchOperationHelpers, ResourceManager } from '../utils/batchOperationHelpers.util';
import { performanceMonitor } from '../utils/performanceMonitor.util';
import { strategyCacheService } from '../services/strategyCache.service';

// Test strategy implementation
class TestBatchDeletionStrategy extends AbstractBatchDeletionStrategy {
  constructor(
    entityType: string = 'test-entity',
    serviceName: string = 'test-service',
    maxBatchSize: number = 50
  ) {
    super(entityType, serviceName, 1, '1.0.0', undefined, undefined, maxBatchSize);
  }

  async execute(context: DeletionContext): Promise<DeletionResult> {
    // Simulate deletion operation
    await new Promise(resolve => setTimeout(resolve, 10));
    
    return {
      success: true,
      deletedEntities: [context.entityId],
      affectedServices: [this.serviceName],
      metadata: { processedAt: Date.now() }
    };
  }

  async validate(context: DeletionContext): Promise<DeletionValidationResult> {
    return {
      isValid: true,
      errors: [],
      warnings: [],
      dependencies: []
    };
  }
}

// Mock strategy that fails
class FailingBatchDeletionStrategy extends AbstractBatchDeletionStrategy {
  constructor() {
    super('failing-entity', 'test-service', 1, '1.0.0', undefined, undefined, 10);
  }

  async execute(context: DeletionContext): Promise<DeletionResult> {
    return {
      success: false,
      deletedEntities: [],
      affectedServices: [this.serviceName],
      error: 'Simulated failure'
    };
  }

  async validate(context: DeletionContext): Promise<DeletionValidationResult> {
    return {
      isValid: true,
      errors: [],
      warnings: [],
      dependencies: []
    };
  }
}

describe('Batch Deletion System', () => {
  let registry: EnhancedEntityDeletionRegistry;
  let testStrategy: TestBatchDeletionStrategy;
  let failingStrategy: FailingBatchDeletionStrategy;

  beforeEach(() => {
    // Clear registry and cache
    registry = EnhancedEntityDeletionRegistry.getInstance();
    registry.clear();
    strategyCacheService.clear();
    performanceMonitor.clearMetrics();

    // Create test strategies
    testStrategy = new TestBatchDeletionStrategy();
    failingStrategy = new FailingBatchDeletionStrategy();
  });

  afterEach(() => {
    registry.clear();
  });

  describe('BatchOperationHelpers', () => {
    describe('splitIntoBatches', () => {
      it('should split array into correct batch sizes', () => {
        const items = Array.from({ length: 25 }, (_, i) => ({ id: i }));
        const batches = BatchOperationHelpers.splitIntoBatches(items, 10);
        
        expect(batches).toHaveLength(3);
        expect(batches[0]).toHaveLength(10);
        expect(batches[1]).toHaveLength(10);
        expect(batches[2]).toHaveLength(5);
      });

      it('should handle empty arrays', () => {
        const batches = BatchOperationHelpers.splitIntoBatches([], 10);
        expect(batches).toHaveLength(0);
      });

      it('should throw error for invalid batch size', () => {
        expect(() => {
          BatchOperationHelpers.splitIntoBatches([1, 2, 3], 0);
        }).toThrow('Batch size must be greater than 0');
      });
    });

    describe('mergeBatchResults', () => {
      it('should merge multiple batch results correctly', () => {
        const results: BatchResult[] = [
          {
            batchId: 'batch1',
            successfulItems: ['1', '2'],
            failedItems: [],
            executionTime: 100,
            databaseOperations: 2,
            memoryUsage: 50
          },
          {
            batchId: 'batch2',
            successfulItems: ['3'],
            failedItems: [{ entityId: '4', error: 'test error' }],
            executionTime: 150,
            databaseOperations: 1,
            memoryUsage: 75
          }
        ];

        const merged = BatchOperationHelpers.mergeBatchResults(results);
        
        expect(merged.successfulItems).toEqual(['1', '2', '3']);
        expect(merged.failedItems).toHaveLength(1);
        expect(merged.executionTime).toBe(250);
        expect(merged.databaseOperations).toBe(3);
        expect(merged.memoryUsage).toBe(75); // Should be the maximum
      });

      it('should handle empty results array', () => {
        const merged = BatchOperationHelpers.mergeBatchResults([]);
        
        expect(merged.batchId).toBe('empty_merge');
        expect(merged.successfulItems).toHaveLength(0);
        expect(merged.failedItems).toHaveLength(0);
      });
    });

    describe('groupByEntityType', () => {
      it('should group items by entity type correctly', () => {
        const items: BatchDeletionItem[] = [
          { entityId: '1', entityType: 'user' },
          { entityId: '2', entityType: 'product' },
          { entityId: '3', entityType: 'user' },
          { entityId: '4', entityType: 'order' }
        ];

        const groups = BatchOperationHelpers.groupByEntityType(items);
        
        expect(groups.size).toBe(3);
        expect(groups.get('user')).toHaveLength(2);
        expect(groups.get('product')).toHaveLength(1);
        expect(groups.get('order')).toHaveLength(1);
      });
    });

    describe('validateBatchItems', () => {
      it('should validate correct batch items', () => {
        const items: BatchDeletionItem[] = [
          { entityId: '1', entityType: 'user' },
          { entityId: '2', entityType: 'product' }
        ];

        const validation = BatchOperationHelpers.validateBatchItems(items);
        
        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      });

      it('should detect missing required fields', () => {
        const items: BatchDeletionItem[] = [
          { entityId: '', entityType: 'user' }, // Missing entityId
          { entityId: '2', entityType: '' } // Missing entityType
        ];

        const validation = BatchOperationHelpers.validateBatchItems(items);
        
        expect(validation.isValid).toBe(false);
        expect(validation.errors).toContain('Item missing required entityId');
        expect(validation.errors).toContain('Item 2 missing required entityType');
      });

      it('should detect duplicate entity IDs', () => {
        const items: BatchDeletionItem[] = [
          { entityId: '1', entityType: 'user' },
          { entityId: '1', entityType: 'user' }
        ];

        const validation = BatchOperationHelpers.validateBatchItems(items);
        
        expect(validation.isValid).toBe(false);
        expect(validation.errors).toContain('Duplicate entity ID found: 1');
      });

      it('should detect self-dependencies', () => {
        const items: BatchDeletionItem[] = [
          { 
            entityId: '1', 
            entityType: 'user',
            dependencies: ['1'] // Self-dependency
          }
        ];

        const validation = BatchOperationHelpers.validateBatchItems(items);
        
        expect(validation.isValid).toBe(false);
        expect(validation.errors).toContain('Self-dependency detected for entity: 1');
      });
    });

    describe('sortItemsByPriorityAndDependencies', () => {
      it('should sort items by priority', () => {
        const items: BatchDeletionItem[] = [
          { entityId: '1', entityType: 'user', priority: 1 },
          { entityId: '2', entityType: 'user', priority: 5 },
          { entityId: '3', entityType: 'user', priority: 3 }
        ];

        const sorted = BatchOperationHelpers.sortItemsByPriorityAndDependencies(items);
        
        expect(sorted[0].entityId).toBe('2'); // Priority 5
        expect(sorted[1].entityId).toBe('3'); // Priority 3
        expect(sorted[2].entityId).toBe('1'); // Priority 1
      });

      it('should handle dependencies correctly', () => {
        const items: BatchDeletionItem[] = [
          { entityId: '1', entityType: 'user' },
          { entityId: '2', entityType: 'user', dependencies: ['1'] },
          { entityId: '3', entityType: 'user', dependencies: ['2'] }
        ];

        const sorted = BatchOperationHelpers.sortItemsByPriorityAndDependencies(items);
        
        // Items with dependencies should come first, in dependency order
        expect(sorted[0].entityId).toBe('1'); // No dependencies
        expect(sorted[1].entityId).toBe('2'); // Depends on 1
        expect(sorted[2].entityId).toBe('3'); // Depends on 2
      });
    });

    describe('analyzeBatchComposition', () => {
      it('should analyze batch composition correctly', () => {
        const items: BatchDeletionItem[] = [
          { entityId: '1', entityType: 'user', priority: 5, metadata: { test: true } },
          { entityId: '2', entityType: 'product', priority: 3 },
          { entityId: '3', entityType: 'user', dependencies: ['2'] }
        ];

        const analysis = BatchOperationHelpers.analyzeBatchComposition(items);
        
        expect(analysis.totalItems).toBe(3);
        expect(analysis.entityTypes.user).toBe(2);
        expect(analysis.entityTypes.product).toBe(1);
        expect(analysis.priorityDistribution[5]).toBe(1);
        expect(analysis.priorityDistribution[3]).toBe(1);
        expect(analysis.priorityDistribution[0]).toBe(1); // Default priority
        expect(analysis.itemsWithDependencies).toBe(1);
        expect(analysis.itemsWithMetadata).toBe(1);
        expect(analysis.averagePriority).toBeCloseTo(2.67, 1);
      });
    });
  });

  describe('ResourceManager', () => {
    describe('checkResourceAvailability', () => {
      it('should check resource availability', () => {
        const availability = ResourceManager.checkResourceAvailability();
        
        expect(availability).toHaveProperty('sufficient');
        expect(availability).toHaveProperty('memoryStatus');
        expect(availability).toHaveProperty('cpuStatus');
        expect(availability).toHaveProperty('recommendations');
        expect(['ok', 'warning', 'critical']).toContain(availability.memoryStatus);
      });
    });

    describe('calculateOptimalAllocation', () => {
      it('should calculate optimal resource allocation', () => {
        const allocation = ResourceManager.calculateOptimalAllocation(1000, 1.5);
        
        expect(allocation).toHaveProperty('maxBatchSize');
        expect(allocation).toHaveProperty('maxConcurrency');
        expect(allocation).toHaveProperty('memoryPerBatch');
        expect(allocation).toHaveProperty('recommendedDelay');
        expect(allocation.maxBatchSize).toBeGreaterThan(0);
        expect(allocation.maxConcurrency).toBeGreaterThan(0);
      });
    });

    describe('createResourceMonitor', () => {
      it('should create resource monitor', async () => {
        const monitor = ResourceManager.createResourceMonitor(100);
        
        monitor.start();
        await new Promise(resolve => setTimeout(resolve, 150));
        monitor.stop();
        
        const report = monitor.getReport();
        expect(report.length).toBeGreaterThan(0);
      });
    });
  });

  describe('AbstractBatchDeletionStrategy', () => {
    describe('processBatch', () => {
      it('should process batch items successfully', async () => {
        const items: BatchDeletionItem[] = [
          { entityId: '1', entityType: 'test-entity' },
          { entityId: '2', entityType: 'test-entity' }
        ];

        const context: BatchDeletionContext = {
          items,
          userId: 'test-user',
          requestId: 'test-request',
          config: { batchSize: 10 }
        };

        const result = await testStrategy.processBatch(items, context);
        
        expect(result.successfulItems).toEqual(['1', '2']);
        expect(result.failedItems).toHaveLength(0);
        expect(result.executionTime).toBeGreaterThan(0);
      });

      it('should handle validation errors', async () => {
        const items: BatchDeletionItem[] = [
          { entityId: '', entityType: 'test-entity' } // Invalid item
        ];

        const context: BatchDeletionContext = {
          items,
          userId: 'test-user'
        };

        const result = await testStrategy.processBatch(items, context);
        
        expect(result.successfulItems).toHaveLength(0);
        expect(result.failedItems).toHaveLength(1);
        expect(result.failedItems[0].error).toContain('Batch validation failed');
      });

      it('should handle processing errors gracefully', async () => {
        const items: BatchDeletionItem[] = [
          { entityId: '1', entityType: 'failing-entity' }
        ];

        const context: BatchDeletionContext = {
          items,
          userId: 'test-user'
        };

        const result = await failingStrategy.processBatch(items, context);
        
        expect(result.successfulItems).toHaveLength(0);
        expect(result.failedItems).toHaveLength(1);
        expect(result.failedItems[0].error).toBe('Simulated failure');
      });
    });

    describe('validateBatch', () => {
      it('should validate correct batch', async () => {
        const items: BatchDeletionItem[] = [
          { entityId: '1', entityType: 'test-entity' },
          { entityId: '2', entityType: 'test-entity' }
        ];

        const context: BatchDeletionContext = {
          items,
          userId: 'test-user'
        };

        const validation = await testStrategy.validateBatch(items, context);
        
        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      });

      it('should reject empty batch', async () => {
        const items: BatchDeletionItem[] = [];
        const context: BatchDeletionContext = {
          items,
          userId: 'test-user'
        };

        const validation = await testStrategy.validateBatch(items, context);
        
        expect(validation.isValid).toBe(false);
        expect(validation.errors).toContain('Batch must contain at least one item');
      });

      it('should reject oversized batch', async () => {
        const items: BatchDeletionItem[] = Array.from({ length: 100 }, (_, i) => ({
          entityId: `${i}`,
          entityType: 'test-entity'
        }));

        const context: BatchDeletionContext = {
          items,
          userId: 'test-user'
        };

        const validation = await testStrategy.validateBatch(items, context);
        
        expect(validation.isValid).toBe(false);
        expect(validation.errors[0]).toContain('exceeds maximum');
      });
    });

    describe('estimateBatchComplexity', () => {
      it('should estimate complexity correctly', async () => {
        const items: BatchDeletionItem[] = [
          { entityId: '1', entityType: 'test-entity' },
          { entityId: '2', entityType: 'test-entity', dependencies: ['1'] },
          { entityId: '3', entityType: 'test-entity', dependencies: ['1', '2'] }
        ];

        const complexity = await testStrategy.estimateBatchComplexity(items);
        
        expect(complexity).toBeGreaterThan(items.length);
      });
    });

    describe('getOptimalBatchSize', () => {
      it('should return optimal batch size', () => {
        const items: BatchDeletionItem[] = Array.from({ length: 25 }, (_, i) => ({
          entityId: `${i}`,
          entityType: 'test-entity'
        }));

        const optimalSize = testStrategy.getOptimalBatchSize(items);
        
        expect(optimalSize).toBeGreaterThan(0);
        expect(optimalSize).toBeLessThanOrEqual(testStrategy.maxBatchSize);
      });
    });

    describe('canProcessInParallel', () => {
      it('should return true for independent items', () => {
        const items: BatchDeletionItem[] = [
          { entityId: '1', entityType: 'test-entity' },
          { entityId: '2', entityType: 'test-entity' }
        ];

        const canParallel = testStrategy.canProcessInParallel(items);
        expect(canParallel).toBe(true);
      });

      it('should return false for dependent items', () => {
        const items: BatchDeletionItem[] = [
          { entityId: '1', entityType: 'test-entity' },
          { entityId: '2', entityType: 'test-entity', dependencies: ['1'] }
        ];

        const canParallel = testStrategy.canProcessInParallel(items);
        expect(canParallel).toBe(false);
      });
    });
  });

  describe('EnhancedEntityDeletionRegistry', () => {
    describe('registration', () => {
      it('should register strategy correctly', () => {
        registry.register(testStrategy);
        
        expect(registry.hasStrategy('test-entity')).toBe(true);
        expect(registry.hasBatchStrategy('test-entity')).toBe(true);
        
        const resolved = registry.resolve('test-entity');
        expect(resolved).toBe(testStrategy);
      });

      it('should unregister strategy correctly', () => {
        registry.register(testStrategy);
        registry.unregister('test-entity', 'test-service');
        
        expect(registry.hasStrategy('test-entity')).toBe(false);
        expect(registry.hasBatchStrategy('test-entity')).toBe(false);
      });
    });

    describe('single deletion', () => {
      beforeEach(() => {
        registry.register(testStrategy);
      });

      it('should execute single deletion successfully', async () => {
        const context: DeletionContext = {
          entityType: 'test-entity',
          entityId: 'test-1',
          userId: 'test-user'
        };

        const result = await registry.execute(context);
        
        expect(result.success).toBe(true);
        expect(result.deletedEntities).toContain('test-1');
        expect(result.affectedServices).toContain('test-service');
      });

      it('should handle missing strategy', async () => {
        const context: DeletionContext = {
          entityType: 'unknown-entity',
          entityId: 'test-1',
          userId: 'test-user'
        };

        const result = await registry.execute(context);
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('No deletion strategy found');
      });
    });

    describe('batch deletion', () => {
      beforeEach(() => {
        registry.register(testStrategy);
      });

      it('should execute batch deletion successfully', async () => {
        const items: BatchDeletionItem[] = [
          { entityId: '1', entityType: 'test-entity' },
          { entityId: '2', entityType: 'test-entity' }
        ];

        const context: BatchDeletionContext = {
          items,
          userId: 'test-user',
          requestId: 'batch-test'
        };

        const result = await registry.executeBatch(context);
        
        expect(result.success).toBe(true);
        expect(result.metrics.totalItems).toBe(2);
        expect(result.metrics.successfulDeletions).toBe(2);
        expect(result.metrics.failedDeletions).toBe(0);
      });

      it('should handle mixed success/failure in batch', async () => {
        // Register both strategies
        registry.register(testStrategy);
        registry.register(failingStrategy);

        const items: BatchDeletionItem[] = [
          { entityId: '1', entityType: 'test-entity' },
          { entityId: '2', entityType: 'failing-entity' }
        ];

        const context: BatchDeletionContext = {
          items,
          userId: 'test-user',
          requestId: 'mixed-batch-test'
        };

        const result = await registry.executeBatch(context);
        
        expect(result.metrics.totalItems).toBe(2);
        expect(result.metrics.successfulDeletions).toBe(1);
        expect(result.metrics.failedDeletions).toBe(1);
      });
    });

    describe('performance monitoring', () => {
      beforeEach(() => {
        registry.register(testStrategy);
      });

      it('should track performance metrics', async () => {
        const context: DeletionContext = {
          entityType: 'test-entity',
          entityId: 'test-1',
          userId: 'test-user'
        };

        await registry.execute(context);
        
        const metrics = performanceMonitor.getAggregatedMetrics();
        expect(metrics.total_operations).toBeGreaterThan(0);
      });

      it('should provide performance report', () => {
        const report = registry.getPerformanceReport();
        
        expect(report).toHaveProperty('registry');
        expect(report).toHaveProperty('cache');
        expect(report).toHaveProperty('batchEngine');
        expect(report).toHaveProperty('resourceUsage');
      });
    });

    describe('caching', () => {
      beforeEach(() => {
        registry.register(testStrategy);
      });

      it('should cache resolved strategies', () => {
        // First resolution should miss cache
        const strategy1 = registry.resolve('test-entity');
        expect(strategy1).toBe(testStrategy);
        
        // Second resolution should hit cache
        const strategy2 = registry.resolve('test-entity');
        expect(strategy2).toBe(testStrategy);
        
        const cacheStats = strategyCacheService.getStats();
        expect(cacheStats.hits).toBeGreaterThan(0);
      });

      it('should warm up cache', async () => {
        await registry.warmUpCache();
        
        const cacheStats = strategyCacheService.getStats();
        expect(cacheStats.entries).toBeGreaterThan(0);
      });
    });

    describe('statistics', () => {
      beforeEach(() => {
        registry.register(testStrategy);
        registry.register(failingStrategy);
      });

      it('should provide comprehensive stats', () => {
        const stats = registry.getStats();
        
        expect(stats.totalStrategies).toBeGreaterThanOrEqual(2);
        expect(stats.batchStrategies).toBeGreaterThanOrEqual(2);
        expect(stats.entitiesSupported).toContain('test-entity');
        expect(stats.entitiesSupported).toContain('failing-entity');
        expect(stats.servicesInvolved).toContain('test-service');
        expect(stats).toHaveProperty('cacheStats');
        expect(stats).toHaveProperty('performanceStats');
        expect(stats).toHaveProperty('batchEngineStats');
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle circular dependencies', () => {
      const items: BatchDeletionItem[] = [
        { entityId: '1', entityType: 'test-entity', dependencies: ['2'] },
        { entityId: '2', entityType: 'test-entity', dependencies: ['1'] }
      ];

      expect(() => {
        BatchOperationHelpers.sortItemsByPriorityAndDependencies(items);
      }).toThrow('Circular dependency detected');
    });

    it('should handle very large batches', async () => {
      registry.register(testStrategy);

      const items: BatchDeletionItem[] = Array.from({ length: 1000 }, (_, i) => ({
        entityId: `${i}`,
        entityType: 'test-entity'
      }));

      const context: BatchDeletionContext = {
        items,
        userId: 'test-user',
        config: { batchSize: 50, maxConcurrentBatches: 2 }
      };

      const result = await registry.executeBatch(context);
      
      expect(result.metrics.totalItems).toBe(1000);
      expect(result.batchResults.length).toBeGreaterThan(0);
    });

    it('should handle memory pressure gracefully', () => {
      // Mock high memory usage
      jest.spyOn(performanceMonitor, 'getCurrentResourceUsage').mockReturnValue({
        memoryUsage: 450, // High memory usage
        cpuUsage: 50,
        databaseConnections: 5,
        networkConnections: 10,
        activeBatches: 2,
        timestamp: Date.now()
      });

      const optimalSize = BatchOperationHelpers.calculateOptimalBatchSize(1000);
      
      // Should reduce batch size under memory pressure
      expect(optimalSize).toBeLessThan(1000);
    });

    it('should handle concurrent batch operations', async () => {
      registry.register(testStrategy);

      const createBatchContext = (id: string): BatchDeletionContext => ({
        items: [
          { entityId: `${id}-1`, entityType: 'test-entity' },
          { entityId: `${id}-2`, entityType: 'test-entity' }
        ],
        userId: 'test-user',
        requestId: `concurrent-${id}`
      });

      // Execute multiple batches concurrently
      const promises = [
        registry.executeBatch(createBatchContext('batch1')),
        registry.executeBatch(createBatchContext('batch2')),
        registry.executeBatch(createBatchContext('batch3'))
      ];

      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.metrics.totalItems).toBe(2);
      });
    });
  });
});