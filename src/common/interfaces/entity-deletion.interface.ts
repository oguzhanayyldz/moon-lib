import { ClientSession } from 'mongoose';

/**
 * Configuration options for entity deletion operations
 */
export interface DeletionConfig {
  /** Whether to use MongoDB transactions for deletion operations */
  useTransactions?: boolean;
  /** Transaction timeout in milliseconds */
  transactionTimeout?: number;
  /** Whether to retry on transaction errors */
  retryOnTransactionError?: boolean;
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Enable detailed logging for deletion operations */
  enableDetailedLogging?: boolean;
}

/**
 * Cascade deletion options for related entities
 */
export interface CascadeOptions {
  /** Enable cascade deletion for related entities */
  enabled: boolean;
  /** Maximum depth for cascade operations */
  maxDepth?: number;
  /** List of entity types to exclude from cascade deletion */
  excludeEntityTypes?: string[];
  /** Force deletion even if dependent entities exist */
  forceDeletion?: boolean;
}

/**
 * Context information for entity deletion operations
 */
export interface DeletionContext {
  /** Type of the entity being deleted */
  entityType: string;
  /** ID of the entity being deleted */
  entityId: string;
  /** ID of the user performing the deletion */
  userId?: string;
  /** Unique request ID for tracking */
  requestId?: string;
  /** Additional metadata for the deletion operation */
  metadata?: Record<string, any>;
  /** MongoDB session for transaction support (optional) */
  transaction?: ClientSession;
  /** Cascade deletion options */
  cascadeOptions?: CascadeOptions;
  /** Configuration for the deletion operation */
  config?: DeletionConfig;
  /** OpenTracing span for operation tracing */
  traceSpan?: any;
  /** Service name performing the deletion */
  serviceName?: string;
}

/**
 * Validation result for deletion operations
 */
export interface DeletionValidationResult {
  /** Whether the validation passed */
  isValid: boolean;
  /** List of validation errors if any */
  errors: string[];
  /** Warning messages that don't prevent deletion */
  warnings?: string[];
  /** Dependencies that will be affected by the deletion */
  dependencies?: string[];
}

/**
 * Metrics collected during deletion operations
 */
export interface DeletionMetrics {
  /** Start time of the operation */
  startTime: number;
  /** End time of the operation */
  endTime: number;
  /** Total execution time in milliseconds */
  executionTime: number;
  /** Number of entities processed */
  entitiesProcessed: number;
  /** Number of database operations performed */
  databaseOperations: number;
  /** Number of transaction operations (if applicable) */
  transactionCount: number;
  /** Whether a rollback occurred */
  rollbackOccurred: boolean;
  /** Service name that performed the deletion */
  serviceName: string;
  /** Strategy name that handled the deletion */
  strategyName: string;
  /** Memory usage during operation (optional) */
  memoryUsage?: number;
}

/**
 * Result of entity deletion operations
 */
export interface DeletionResult {
  /** Whether the deletion was successful */
  success: boolean;
  /** List of entity IDs that were successfully deleted */
  deletedEntities: string[];
  /** List of services that were affected by the deletion */
  affectedServices: string[];
  /** Data needed for rollback operations (if supported) */
  rollbackData?: any;
  /** Performance and operation metrics */
  metrics?: DeletionMetrics;
  /** Error message if deletion failed */
  error?: string;
  /** Additional result metadata */
  metadata?: Record<string, any>;
}

/**
 * Core interface for entity deletion strategies
 * 
 * Each entity type should have its own implementation of this interface
 * that defines how that specific entity should be deleted and what
 * cascade operations should be performed.
 */
export interface EntityDeletionStrategy<T = any> {
  /** The entity type this strategy handles */
  readonly entityType: string;
  /** Priority of this strategy (higher numbers have higher priority) */
  readonly priority: number;
  /** Service name that owns this strategy */
  readonly serviceName: string;
  /** Version of the strategy implementation */
  readonly version?: string;
  /** Entity ownership (native/foreign) */
  readonly ownership?: string;
  /** Deletion type (soft/hard/cascade) */
  readonly deletionType?: string;
  
  // Batch processing properties (optional for backward compatibility)
  /** Whether this strategy supports batch processing */
  readonly supportsBatch?: boolean;
  /** Maximum number of items that can be processed in a single batch */
  readonly maxBatchSize?: number;
  
  /**
   * Check if this strategy can handle the given entity type and ID
   * 
   * @param entityType The type of entity to delete
   * @param entityId The ID of the entity to delete
   * @returns Whether this strategy can handle the deletion
   */
  canHandle(entityType: string, entityId: string): boolean;
  
  /**
   * Validate whether the entity can be safely deleted
   * 
   * @param context The deletion context
   * @returns Validation result with any errors or warnings
   */
  validate(context: DeletionContext): Promise<DeletionValidationResult>;
  
  /**
   * Execute the entity deletion operation
   * 
   * @param context The deletion context
   * @returns Result of the deletion operation
   */
  execute(context: DeletionContext): Promise<DeletionResult>;
  
  /**
   * Rollback the deletion operation if supported
   * 
   * @param context The deletion context
   * @param error The error that triggered the rollback
   * @returns Promise that resolves when rollback is complete
   */
  rollback?(context: DeletionContext, error: Error): Promise<void>;
  
  /**
   * Get a list of entity types that depend on this entity
   * 
   * @param entityId The ID of the entity
   * @returns List of dependent entity types
   */
  getDependencies?(entityId: string): Promise<string[]>;
  
  /**
   * Estimate the cost/complexity of deleting this entity
   * 
   * @param entityId The ID of the entity
   * @returns Estimated operation cost (for optimization)
   */
  estimateComplexity?(entityId: string): Promise<number>;
  
  // Batch processing methods (optional for backward compatibility)
  /**
   * Process a batch of items (only for strategies that support batch processing)
   * 
   * @param items Array of items to process
   * @param context Batch deletion context
   * @returns Promise that resolves to batch result
   */
  processBatch?(items: any[], context: any): Promise<any>;
  
  /**
   * Validate a batch of items before processing
   * 
   * @param items Array of items to validate
   * @param context Optional batch context
   * @returns Promise that resolves to validation result
   */
  validateBatch?(items: any[], context?: any): Promise<any>;
  
  /**
   * Estimate processing time for a batch
   * 
   * @param items Array of items to estimate
   * @returns Promise that resolves to estimated time in milliseconds
   */
  estimateProcessingTime?(items: any[]): Promise<number>;
  
  /**
   * Check if the strategy can handle the given batch items
   * 
   * @param items Array of items to check
   * @returns Whether the strategy can handle all items
   */
  canHandleBatch?(items: any[]): boolean;
}

/**
 * Type alias for strategies that support batch processing
 * This is a subset of EntityDeletionStrategy with required batch properties
 */
export type BatchDeletionStrategy = EntityDeletionStrategy & {
  readonly supportsBatch: true;
  readonly maxBatchSize: number;
};

/**
 * Interface for registering and resolving entity deletion strategies
 */
export interface IEntityDeletionRegistry {
  /**
   * Register a deletion strategy for an entity type
   * 
   * @param strategy The strategy to register
   */
  register(strategy: EntityDeletionStrategy): void;
  
  /**
   * Unregister a deletion strategy
   * 
   * @param entityType The entity type to unregister
   * @param serviceName Optional service name for disambiguation
   */
  unregister(entityType: string, serviceName?: string): void;
  
  /**
   * Resolve the best strategy for an entity type
   * 
   * @param entityType The entity type to find a strategy for
   * @returns The best matching strategy or null if none found
   */
  resolve(entityType: string): EntityDeletionStrategy | null;
  
  /**
   * Get all registered strategies
   * 
   * @returns Map of entity types to their strategies
   */
  getAllStrategies(): Map<string, EntityDeletionStrategy[]>;
  
  /**
   * Execute entity deletion with automatic strategy resolution
   * 
   * @param context The deletion context
   * @returns Result of the deletion operation
   */
  execute(context: DeletionContext): Promise<DeletionResult>;
  
  /**
   * Execute entity deletion with transaction support if configured
   * 
   * @param context The deletion context
   * @returns Result of the deletion operation
   */
  executeWithTransaction(context: DeletionContext): Promise<DeletionResult>;
  
  /**
   * Check if a strategy is registered for an entity type
   * 
   * @param entityType The entity type to check
   * @returns Whether a strategy is registered
   */
  hasStrategy(entityType: string): boolean;
  
  /**
   * Get statistics about registered strategies
   * 
   * @returns Registry statistics
   */
  getStats(): {
    totalStrategies: number;
    entitiesSupported: string[];
    servicesInvolved: string[];
  };
}