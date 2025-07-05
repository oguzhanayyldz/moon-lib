import { ClientSession } from 'mongoose';
import { DeletionContext, DeletionResult, DeletionConfig } from './entity-deletion.interface';

/**
 * Batch processing configuration for deletion operations
 */
export interface BatchDeletionConfig extends DeletionConfig {
  /** Maximum number of entities to process in a single batch */
  batchSize?: number;
  /** Maximum number of parallel batches to process */
  maxConcurrentBatches?: number;
  /** Timeout for each batch operation in milliseconds */
  batchTimeout?: number;
  /** Whether to continue processing other batches if one fails */
  continueOnBatchFailure?: boolean;
  /** Whether to use bulk operations for database operations */
  useBulkOperations?: boolean;
  /** Maximum memory usage threshold (MB) before pausing operations */
  memoryThreshold?: number;
  /** Whether to enable performance monitoring */
  enablePerformanceMonitoring?: boolean;
  /** Whether to enable connection pooling optimizations */
  enableConnectionPooling?: boolean;
  /** Minimum delay between batches in milliseconds */
  batchDelay?: number;
}

/**
 * Batch item representing a single entity to be deleted
 */
export interface BatchDeletionItem {
  /** Type of the entity */
  entityType: string;
  /** ID of the entity */
  entityId: string;
  /** Additional metadata for this specific entity */
  metadata?: Record<string, any>;
  /** Priority of this item within the batch */
  priority?: number;
  /** Dependencies that must be deleted before this item */
  dependencies?: string[];
}

/**
 * Context for batch deletion operations
 */
export interface BatchDeletionContext {
  /** Array of items to be deleted */
  items: BatchDeletionItem[];
  /** User ID performing the operation */
  userId?: string;
  /** Unique request ID for tracking */
  requestId?: string;
  /** MongoDB session for transaction support */
  transaction?: ClientSession;
  /** Configuration for batch operations */
  config?: BatchDeletionConfig;
  /** OpenTracing span for operation tracing */
  traceSpan?: any;
  /** Service name performing the deletion */
  serviceName?: string;
  /** Additional metadata for the entire batch operation */
  metadata?: Record<string, any>;
}

/**
 * Performance metrics for batch operations
 */
export interface BatchPerformanceMetrics {
  /** Total items processed */
  totalItems: number;
  /** Number of successful deletions */
  successfulDeletions: number;
  /** Number of failed deletions */
  failedDeletions: number;
  /** Total execution time in milliseconds */
  totalExecutionTime: number;
  /** Average time per item in milliseconds */
  averageTimePerItem: number;
  /** Number of batches processed */
  batchesProcessed: number;
  /** Number of parallel operations */
  parallelOperations: number;
  /** Memory usage at peak (MB) */
  peakMemoryUsage: number;
  /** Database operations performed */
  databaseOperations: number;
  /** Network operations performed */
  networkOperations: number;
  /** Number of retries performed */
  retriesPerformed: number;
  /** Connection pool statistics */
  connectionPoolStats?: {
    activeConnections: number;
    maxConnections: number;
    poolUtilization: number;
  };
}

/**
 * Result of a single batch operation
 */
export interface BatchResult {
  /** Batch ID for tracking */
  batchId: string;
  /** Items that were successfully processed */
  successfulItems: string[];
  /** Items that failed to process */
  failedItems: Array<{
    entityId: string;
    error: string;
  }>;
  /** Execution time for this batch */
  executionTime: number;
  /** Number of database operations performed */
  databaseOperations: number;
  /** Memory usage during batch processing */
  memoryUsage: number;
}

/**
 * Complete result of batch deletion operation
 */
export interface BatchDeletionResult {
  /** Overall success status */
  success: boolean;
  /** Individual batch results */
  batchResults: BatchResult[];
  /** Overall performance metrics */
  metrics: BatchPerformanceMetrics;
  /** Services that were affected */
  affectedServices: string[];
  /** Error message if operation failed */
  error?: string;
  /** Detailed error information */
  errors?: Array<{
    entityId: string;
    entityType: string;
    error: string;
    batchId: string;
  }>;
  /** Rollback information if applicable */
  rollbackData?: any;
  /** Additional result metadata */
  metadata?: Record<string, any>;
}

/**
 * Resource usage tracking for batch operations
 */
export interface ResourceUsage {
  /** Current memory usage in MB */
  memoryUsage: number;
  /** CPU usage percentage */
  cpuUsage: number;
  /** Database connection count */
  databaseConnections: number;
  /** Network connection count */
  networkConnections: number;
  /** Active batch operations */
  activeBatches: number;
  /** Timestamp of measurement */
  timestamp: number;
}

/**
 * Batch processing strategy interface
 */
export interface BatchProcessingStrategy {
  /** Name of the strategy */
  name: string;
  /** Whether this strategy supports parallel processing */
  supportsParallel: boolean;
  /** Maximum recommended batch size */
  maxBatchSize: number;
  /** Whether transactions are supported */
  supportsTransactions: boolean;
  
  /**
   * Process a batch of items
   */
  processBatch(
    items: BatchDeletionItem[],
    context: BatchDeletionContext
  ): Promise<BatchResult>;
  
  /**
   * Estimate processing time for a batch
   */
  estimateProcessingTime(items: BatchDeletionItem[]): Promise<number>;
  
  /**
   * Check if the strategy can handle the given items
   */
  canHandle(items: BatchDeletionItem[]): boolean;
}

/**
 * Connection pool configuration for batch operations
 */
export interface ConnectionPoolConfig {
  /** Maximum number of connections in pool */
  maxConnections: number;
  /** Minimum number of connections to maintain */
  minConnections: number;
  /** Connection timeout in milliseconds */
  connectionTimeout: number;
  /** Idle timeout for connections */
  idleTimeout: number;
  /** Whether to enable connection validation */
  enableValidation: boolean;
  /** Validation query for connections */
  validationQuery?: string;
}

/**
 * Batch queue configuration
 */
export interface BatchQueueConfig {
  /** Maximum queue size */
  maxQueueSize: number;
  /** Queue processing strategy */
  processingStrategy: 'fifo' | 'lifo' | 'priority';
  /** Whether to enable queue persistence */
  enablePersistence: boolean;
  /** Persistence storage path */
  persistencePath?: string;
  /** Queue monitoring interval */
  monitoringInterval: number;
}

/**
 * Memory management configuration for batch operations
 */
export interface MemoryManagementConfig {
  /** Maximum memory usage threshold (MB) */
  maxMemoryUsage: number;
  /** Memory check interval in milliseconds */
  checkInterval: number;
  /** Action to take when memory threshold is exceeded */
  thresholdAction: 'pause' | 'reduce_batch_size' | 'cancel';
  /** Whether to enable garbage collection optimization */
  enableGcOptimization: boolean;
  /** Memory usage reporting interval */
  reportingInterval: number;
}

/**
 * Performance optimization settings
 */
export interface PerformanceOptimizationConfig {
  /** Whether to enable query optimization */
  enableQueryOptimization: boolean;
  /** Whether to enable index hints */
  enableIndexHints: boolean;
  /** Whether to enable result caching */
  enableResultCaching: boolean;
  /** Cache TTL in seconds */
  cacheTtl: number;
  /** Whether to enable compression */
  enableCompression: boolean;
  /** Compression algorithm */
  compressionAlgorithm: 'gzip' | 'lz4' | 'snappy';
}

// BatchDeletionStrategy is now defined as a type alias in entity-deletion.interface.ts
// This prevents naming conflicts and ensures consistency

/**
 * Cache configuration for strategy resolution
 */
export interface StrategyCacheConfig {
  /** Whether to enable caching */
  enabled: boolean;
  /** Cache TTL in seconds */
  ttl: number;
  /** Maximum cache size */
  maxSize: number;
  /** Cache eviction policy */
  evictionPolicy: 'lru' | 'lfu' | 'ttl';
  /** Whether to enable cache warming */
  enableWarming: boolean;
}

/**
 * Monitoring and alerting configuration
 */
export interface MonitoringConfig {
  /** Whether to enable monitoring */
  enabled: boolean;
  /** Metrics collection interval */
  metricsInterval: number;
  /** Alert thresholds */
  alertThresholds: {
    /** Memory usage threshold for alerts */
    memoryUsage: number;
    /** Error rate threshold */
    errorRate: number;
    /** Processing time threshold */
    processingTime: number;
  };
  /** Metrics export configuration */
  metricsExport?: {
    /** Export endpoint */
    endpoint: string;
    /** Export interval */
    interval: number;
    /** Export format */
    format: 'prometheus' | 'json' | 'csv';
  };
}