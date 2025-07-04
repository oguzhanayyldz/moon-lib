import { 
  EntityDeletionStrategy, 
  DeletionContext, 
  DeletionResult, 
  DeletionValidationResult,
  DeletionMetrics 
} from '../interfaces/entity-deletion.interface';
import { logger } from '../../services/logger.service';

/**
 * Abstract base class for entity deletion strategies
 * 
 * Provides common functionality and patterns that all deletion strategies
 * can inherit and use. This includes tracing, logging, metrics collection,
 * and error handling.
 */
export abstract class AbstractDeletionStrategy implements EntityDeletionStrategy {
  protected readonly logger = logger;
  protected tracer: any;

  constructor(
    public readonly entityType: string,
    public readonly serviceName: string,
    public readonly priority: number = 1,
    public readonly version: string = '1.0.0'
  ) {
    // Initialize tracer if available
    try {
      this.tracer = require('../../../tracer').tracer;
    } catch (error) {
      // Tracer not available, continue without tracing
      this.tracer = null;
    }
  }

  /**
   * Default implementation checks if the entity type matches
   * Can be overridden for more complex matching logic
   */
  canHandle(entityType: string, entityId: string): boolean {
    return entityType === this.entityType;
  }

  /**
   * Default validation implementation
   * Should be overridden by specific strategies for custom validation
   */
  async validate(context: DeletionContext): Promise<DeletionValidationResult> {
    const result: DeletionValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      dependencies: []
    };

    // Basic validation
    if (!context.entityId) {
      result.isValid = false;
      result.errors.push('Entity ID is required');
    }

    if (!context.entityType) {
      result.isValid = false;
      result.errors.push('Entity type is required');
    }

    return result;
  }

  /**
   * Abstract method that must be implemented by concrete strategies
   */
  abstract execute(context: DeletionContext): Promise<DeletionResult>;

  /**
   * Default rollback implementation (no-op)
   * Can be overridden by strategies that support rollback
   */
  async rollback?(context: DeletionContext, error: Error): Promise<void> {
    this.logger.warn(`Rollback not implemented for ${this.entityType} deletion strategy`, {
      entityType: context.entityType,
      entityId: context.entityId,
      error: error.message
    });
  }

  /**
   * Execute operation with tracing support
   * 
   * @param operationName Name of the operation for tracing
   * @param context Deletion context
   * @param operation The operation to execute
   * @returns Result of the operation
   */
  protected async executeWithTracing<T>(
    operationName: string,
    context: DeletionContext,
    operation: () => Promise<T>
  ): Promise<T> {
    const span = this.tracer?.startSpan(operationName);
    
    try {
      // Set tracing tags
      if (span) {
        span.setTag('entity.type', context.entityType);
        span.setTag('entity.id', context.entityId);
        span.setTag('service.name', this.serviceName);
        span.setTag('strategy.name', this.constructor.name);
        span.setTag('user.id', context.userId || 'system');
        
        if (context.transaction) {
          span.setTag('transaction.enabled', true);
        }
      }

      return await operation();
    } catch (error) {
      if (span) {
        span.setTag('error', true);
        span.setTag('error.message', error instanceof Error ? error.message : 'Unknown error');
      }
      throw error;
    } finally {
      span?.finish();
    }
  }

  /**
   * Execute operation with metrics collection
   * 
   * @param context Deletion context
   * @param operation The operation to execute
   * @returns Result with metrics included
   */
  protected async executeWithMetrics(
    context: DeletionContext,
    operation: () => Promise<DeletionResult>
  ): Promise<DeletionResult> {
    const startTime = Date.now();
    let databaseOperations = 0;
    let transactionCount = 0;
    let rollbackOccurred = false;

    try {
      const result = await operation();
      
      const endTime = Date.now();
      const metrics: DeletionMetrics = {
        startTime,
        endTime,
        executionTime: endTime - startTime,
        entitiesProcessed: result.deletedEntities?.length || 0,
        databaseOperations,
        transactionCount: context.transaction ? 1 : 0,
        rollbackOccurred,
        serviceName: this.serviceName,
        strategyName: this.constructor.name
      };

      return {
        ...result,
        metrics
      };
    } catch (error) {
      rollbackOccurred = true;
      const endTime = Date.now();
      
      const failureMetrics: DeletionMetrics = {
        startTime,
        endTime,
        executionTime: endTime - startTime,
        entitiesProcessed: 0,
        databaseOperations,
        transactionCount: context.transaction ? 1 : 0,
        rollbackOccurred,
        serviceName: this.serviceName,
        strategyName: this.constructor.name
      };

      throw error;
    }
  }

  /**
   * Execute operation with comprehensive error handling
   * 
   * @param context Deletion context
   * @param operation The operation to execute
   * @returns Result of the operation
   */
  protected async executeWithErrorHandling(
    context: DeletionContext,
    operation: () => Promise<DeletionResult>
  ): Promise<DeletionResult> {
    try {
      return await operation();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      this.logger.error(`Error in ${this.entityType} deletion strategy`, {
        entityType: context.entityType,
        entityId: context.entityId,
        serviceName: this.serviceName,
        strategy: this.constructor.name,
        error: errorMessage,
        userId: context.userId
      });

      // Attempt rollback if supported and context has transaction
      if (this.rollback && context.transaction) {
        try {
          await this.rollback(context, error as Error);
          this.logger.info(`Rollback completed for ${this.entityType}`, {
            entityType: context.entityType,
            entityId: context.entityId
          });
        } catch (rollbackError) {
          this.logger.error(`Rollback failed for ${this.entityType}`, {
            entityType: context.entityType,
            entityId: context.entityId,
            rollbackError: rollbackError instanceof Error ? rollbackError.message : 'Unknown rollback error'
          });
        }
      }

      return {
        success: false,
        deletedEntities: [],
        affectedServices: [this.serviceName],
        error: errorMessage
      };
    }
  }

  /**
   * Helper method to create a successful deletion result
   * 
   * @param deletedEntities List of deleted entity IDs
   * @param affectedServices List of affected services
   * @param metadata Additional result metadata
   * @returns Successful deletion result
   */
  protected createSuccessResult(
    deletedEntities: string[],
    affectedServices: string[] = [this.serviceName],
    metadata?: Record<string, any>
  ): DeletionResult {
    return {
      success: true,
      deletedEntities,
      affectedServices,
      metadata
    };
  }

  /**
   * Helper method to create a failed deletion result
   * 
   * @param error Error message
   * @param metadata Additional result metadata
   * @returns Failed deletion result
   */
  protected createFailureResult(
    error: string,
    metadata?: Record<string, any>
  ): DeletionResult {
    return {
      success: false,
      deletedEntities: [],
      affectedServices: [this.serviceName],
      error,
      metadata
    };
  }

  /**
   * Log deletion operation details
   * 
   * @param context Deletion context
   * @param result Deletion result
   */
  protected logDeletionOperation(context: DeletionContext, result: DeletionResult): void {
    const logLevel = result.success ? 'info' : 'error';
    
    this.logger[logLevel](`Entity deletion ${result.success ? 'completed' : 'failed'}`, {
      entityType: context.entityType,
      entityId: context.entityId,
      serviceName: this.serviceName,
      strategy: this.constructor.name,
      success: result.success,
      deletedEntities: result.deletedEntities,
      affectedServices: result.affectedServices,
      executionTime: result.metrics?.executionTime,
      error: result.error,
      userId: context.userId
    });
  }

  /**
   * Check if transactions are enabled and available
   * 
   * @param context Deletion context
   * @returns Whether transactions should be used
   */
  protected shouldUseTransaction(context: DeletionContext): boolean {
    return Boolean(
      context.config?.useTransactions && 
      context.transaction
    );
  }

  /**
   * Get configuration with defaults
   * 
   * @param context Deletion context
   * @returns Configuration with default values applied
   */
  protected getConfigWithDefaults(context: DeletionContext) {
    return {
      useTransactions: false,
      transactionTimeout: 30000,
      retryOnTransactionError: true,
      maxRetries: 3,
      enableDetailedLogging: false,
      ...context.config
    };
  }
}