import { 
  EntityDeletionStrategy, 
  IEntityDeletionRegistry,
  DeletionContext, 
  DeletionResult 
} from '../common/interfaces/entity-deletion.interface';
import { logger } from './logger.service';

/**
 * Default configuration for entity deletion operations
 */
const DEFAULT_DELETION_CONFIG = {
  useTransactions: false,
  transactionTimeout: 30000,
  retryOnTransactionError: true,
  maxRetries: 3,
  enableDetailedLogging: false
};

/**
 * Registry for managing entity deletion strategies
 * 
 * This singleton class manages the registration and resolution of entity deletion
 * strategies across all services. It provides a centralized way to handle entity
 * deletions with support for both transaction-based and non-transaction operations.
 */
export class EntityDeletionRegistry implements IEntityDeletionRegistry {
  private static instance: EntityDeletionRegistry;
  private strategies = new Map<string, EntityDeletionStrategy[]>();
  private transactionManager: any;
  private initializationErrors = new Map<string, Error>();
  private retryAttempts = new Map<string, number>();
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY_MS = 1000;

  private constructor() {
    // Try to import transaction manager if available
    try {
      const { transactionManager } = require('../database/index');
      this.transactionManager = transactionManager;
    } catch (error) {
      logger.debug('Transaction manager not available, will use non-transaction mode');
      this.transactionManager = null;
    }
  }

  /**
   * Get the singleton instance of the registry
   */
  public static getInstance(): EntityDeletionRegistry {
    if (!EntityDeletionRegistry.instance) {
      EntityDeletionRegistry.instance = new EntityDeletionRegistry();
    }
    return EntityDeletionRegistry.instance;
  }

  /**
   * Register a deletion strategy for an entity type with resilience
   */
  register(strategy: EntityDeletionStrategy): void {
    try {
      // Validate strategy before registration
      this.validateStrategy(strategy);
    const entityType = strategy.entityType;
    
    if (!this.strategies.has(entityType)) {
      this.strategies.set(entityType, []);
    }

    const strategies = this.strategies.get(entityType)!;
    
    // Check if strategy with same service name already exists
    const existingIndex = strategies.findIndex(
      s => s.serviceName === strategy.serviceName
    );

    if (existingIndex >= 0) {
      // Replace existing strategy
      strategies[existingIndex] = strategy;
      logger.info(`Replaced existing deletion strategy for ${entityType}`, {
        entityType,
        serviceName: strategy.serviceName,
        strategyName: strategy.constructor.name
      });
    } else {
      // Add new strategy
      strategies.push(strategy);
      logger.info(`Registered new deletion strategy for ${entityType}`, {
        entityType,
        serviceName: strategy.serviceName,
        strategyName: strategy.constructor.name,
        priority: strategy.priority
      });
    }

    // Sort strategies by priority (highest first)
    strategies.sort((a, b) => b.priority - a.priority);
    
    // Clear any initialization errors for this entity type
    this.initializationErrors.delete(entityType);
    this.retryAttempts.delete(entityType);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to register deletion strategy for ${strategy.entityType}`, {
        entityType: strategy.entityType,
        serviceName: strategy.serviceName,
        error: errorMessage
      });
      
      // Store initialization error for retry
      this.initializationErrors.set(strategy.entityType, error as Error);
      
      // Schedule retry if not exceeded max attempts
      this.scheduleRetryRegistration(strategy);
      
      throw new Error(`Strategy registration failed: ${errorMessage}`);
    }
  }

  /**
   * Unregister a deletion strategy
   */
  unregister(entityType: string, serviceName?: string): void {
    const strategies = this.strategies.get(entityType);
    
    if (!strategies) {
      logger.warn(`No strategies found for entity type: ${entityType}`);
      return;
    }

    if (serviceName) {
      // Remove specific service strategy
      const filteredStrategies = strategies.filter(s => s.serviceName !== serviceName);
      
      if (filteredStrategies.length !== strategies.length) {
        this.strategies.set(entityType, filteredStrategies);
        logger.info(`Unregistered deletion strategy for ${entityType}`, {
          entityType,
          serviceName
        });
      } else {
        logger.warn(`No strategy found for service ${serviceName} and entity type ${entityType}`);
      }
    } else {
      // Remove all strategies for the entity type
      this.strategies.delete(entityType);
      logger.info(`Unregistered all deletion strategies for ${entityType}`, {
        entityType
      });
    }
  }

  /**
   * Resolve the best strategy for an entity type with fallback handling
   */
  resolve(entityType: string): EntityDeletionStrategy | null {
    // Check if there are initialization errors for this entity type
    if (this.initializationErrors.has(entityType)) {
      logger.warn(`Strategy resolution attempted for entity type with initialization errors`, {
        entityType,
        error: this.initializationErrors.get(entityType)?.message
      });
    }
    const strategies = this.strategies.get(entityType);
    
    if (!strategies || strategies.length === 0) {
      logger.warn(`No deletion strategy found for entity type: ${entityType}`);
      return null;
    }

    // Return the highest priority strategy
    const selectedStrategy = strategies[0];
    
    logger.debug(`Resolved deletion strategy for ${entityType}`, {
      entityType,
      serviceName: selectedStrategy.serviceName,
      strategyName: selectedStrategy.constructor.name,
      priority: selectedStrategy.priority
    });

    return selectedStrategy;
  }

  /**
   * Get all registered strategies
   */
  getAllStrategies(): Map<string, EntityDeletionStrategy[]> {
    return new Map(this.strategies);
  }

  /**
   * Execute entity deletion with automatic strategy resolution and resilience
   */
  async execute(context: DeletionContext): Promise<DeletionResult> {
    // Check for initialization errors
    if (this.initializationErrors.has(context.entityType)) {
      const error = this.initializationErrors.get(context.entityType)!;
      logger.warn(`Attempting execution for entity type with initialization errors`, {
        entityType: context.entityType,
        initError: error.message
      });
    }
    // Apply default configuration
    const configWithDefaults = {
      ...DEFAULT_DELETION_CONFIG,
      ...context.config
    };

    const enhancedContext = {
      ...context,
      config: configWithDefaults
    };

    // Check if transactions are requested and available
    if (configWithDefaults.useTransactions && this.transactionManager) {
      return await this.executeWithTransaction(enhancedContext);
    } else {
      return await this.executeWithoutTransaction(enhancedContext);
    }
  }

  /**
   * Execute entity deletion with transaction support
   */
  async executeWithTransaction(context: DeletionContext): Promise<DeletionResult> {
    if (!this.transactionManager) {
      logger.warn('Transaction requested but transaction manager not available, falling back to non-transaction mode');
      return await this.executeWithoutTransaction(context);
    }

    const strategy = this.resolve(context.entityType);
    
    if (!strategy) {
      return {
        success: false,
        deletedEntities: [],
        affectedServices: [],
        error: `No deletion strategy found for entity type: ${context.entityType}`
      };
    }

    logger.info(`Executing entity deletion with transaction`, {
      entityType: context.entityType,
      entityId: context.entityId,
      serviceName: strategy.serviceName,
      strategy: strategy.constructor.name
    });

    try {
      return await this.transactionManager.executeTransaction(
        `entity_deletion_${context.entityType}_${Date.now()}`,
        [
          {
            id: 'validate_deletion',
            execute: async (session: any) => {
              const validation = await strategy.validate({
                ...context,
                transaction: session
              });
              
              if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
              }
              
              return validation;
            }
          },
          {
            id: 'execute_deletion',
            isResultOperation: true,
            execute: async (session: any) => {
              return await strategy.execute({
                ...context,
                transaction: session
              });
            }
          }
        ]
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
      
      logger.error('Entity deletion transaction failed', {
        entityType: context.entityType,
        entityId: context.entityId,
        error: errorMessage
      });

      return {
        success: false,
        deletedEntities: [],
        affectedServices: [strategy.serviceName],
        error: `Transaction failed: ${errorMessage}`
      };
    }
  }

  /**
   * Execute entity deletion without transaction with resilience
   */
  async executeWithoutTransaction(context: DeletionContext): Promise<DeletionResult> {
    const strategy = this.resolve(context.entityType);
    
    if (!strategy) {
      // Enhanced error reporting with initialization status
      const initStatus = this.getInitializationStatus();
      const hasInitError = initStatus.errorsByEntity[context.entityType];
      
      const errorMessage = hasInitError 
        ? `No deletion strategy found for entity type: ${context.entityType}. Initialization error: ${hasInitError}`
        : `No deletion strategy found for entity type: ${context.entityType}`;
      
      return {
        success: false,
        deletedEntities: [],
        affectedServices: [],
        error: errorMessage,
        metadata: {
          initializationErrors: hasInitError ? true : false,
          retryAttempts: initStatus.retryAttempts[context.entityType] || 0
        }
      };
    }

    logger.info(`Executing entity deletion without transaction`, {
      entityType: context.entityType,
      entityId: context.entityId,
      serviceName: strategy.serviceName,
      strategy: strategy.constructor.name
    });

    try {
      // Validate before execution with retry
      const validation = await this.executeWithRetry(
        () => strategy.validate(context),
        `validation for ${context.entityType}`,
        context.config?.maxRetries || this.MAX_RETRY_ATTEMPTS
      );
      
      if (!validation.isValid) {
        return {
          success: false,
          deletedEntities: [],
          affectedServices: [strategy.serviceName],
          error: `Validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Execute deletion with retry
      const result = await this.executeWithRetry(
        () => strategy.execute(context),
        `deletion for ${context.entityType}`,
        context.config?.maxRetries || this.MAX_RETRY_ATTEMPTS
      );
      
      logger.info(`Entity deletion completed`, {
        entityType: context.entityType,
        entityId: context.entityId,
        success: result.success,
        deletedEntities: result.deletedEntities,
        affectedServices: result.affectedServices
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Deletion failed';
      
      logger.error('Entity deletion failed after retries', {
        entityType: context.entityType,
        entityId: context.entityId,
        serviceName: strategy.serviceName,
        error: errorMessage,
        maxRetries: context.config?.maxRetries || this.MAX_RETRY_ATTEMPTS
      });

      return {
        success: false,
        deletedEntities: [],
        affectedServices: [strategy.serviceName],
        error: errorMessage,
        metadata: {
          retriesExhausted: true,
          maxRetries: context.config?.maxRetries || this.MAX_RETRY_ATTEMPTS
        }
      };
    }
  }

  /**
   * Check if a strategy is registered for an entity type
   */
  hasStrategy(entityType: string): boolean {
    const strategies = this.strategies.get(entityType);
    return Boolean(strategies && strategies.length > 0);
  }

  /**
   * Get statistics about registered strategies
   */
  getStats(): {
    totalStrategies: number;
    entitiesSupported: string[];
    servicesInvolved: string[];
  } {
    const allStrategies = Array.from(this.strategies.values()).flat();
    const servicesInvolved = [...new Set(allStrategies.map(s => s.serviceName))];
    
    return {
      totalStrategies: allStrategies.length,
      entitiesSupported: Array.from(this.strategies.keys()),
      servicesInvolved
    };
  }

  /**
   * Clear all registered strategies (for testing purposes)
   */
  clear(): void {
    this.strategies.clear();
    this.initializationErrors.clear();
    this.retryAttempts.clear();
    logger.info('Cleared all registered deletion strategies');
  }

  /**
   * Check if transaction manager is available
   */
  isTransactionManagerAvailable(): boolean {
    return Boolean(this.transactionManager);
  }

  /**
   * Validate strategy before registration
   */
  private validateStrategy(strategy: EntityDeletionStrategy): void {
    if (!strategy) {
      throw new Error('Strategy cannot be null or undefined');
    }
    
    if (!strategy.entityType) {
      throw new Error('Strategy must have an entityType');
    }
    
    if (!strategy.serviceName) {
      throw new Error('Strategy must have a serviceName');
    }
    
    if (typeof strategy.execute !== 'function') {
      throw new Error('Strategy must implement execute method');
    }
    
    if (typeof strategy.validate !== 'function') {
      throw new Error('Strategy must implement validate method');
    }
    
    if (typeof strategy.priority !== 'number' || strategy.priority < 0) {
      throw new Error('Strategy must have a valid priority (number >= 0)');
    }
  }

  /**
   * Schedule retry registration for failed strategies
   */
  private scheduleRetryRegistration(strategy: EntityDeletionStrategy): void {
    const entityType = strategy.entityType;
    const currentAttempts = this.retryAttempts.get(entityType) || 0;
    
    if (currentAttempts >= this.MAX_RETRY_ATTEMPTS) {
      logger.error(`Max retry attempts exceeded for strategy registration`, {
        entityType,
        serviceName: strategy.serviceName,
        maxAttempts: this.MAX_RETRY_ATTEMPTS
      });
      return;
    }
    
    this.retryAttempts.set(entityType, currentAttempts + 1);
    
    logger.info(`Scheduling retry registration for strategy`, {
      entityType,
      serviceName: strategy.serviceName,
      attempt: currentAttempts + 1,
      maxAttempts: this.MAX_RETRY_ATTEMPTS,
      delayMs: this.RETRY_DELAY_MS
    });
    
    setTimeout(() => {
      try {
        this.register(strategy);
        logger.info(`Retry registration successful for strategy`, {
          entityType,
          serviceName: strategy.serviceName,
          attempt: currentAttempts + 1
        });
      } catch (error) {
        logger.warn(`Retry registration failed for strategy`, {
          entityType,
          serviceName: strategy.serviceName,
          attempt: currentAttempts + 1,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, this.RETRY_DELAY_MS * Math.pow(2, currentAttempts)); // Exponential backoff
  }

  /**
   * Get initialization status for debugging
   */
  getInitializationStatus(): {
    totalErrors: number;
    errorsByEntity: Record<string, string>;
    retryAttempts: Record<string, number>;
  } {
    const errorsByEntity: Record<string, string> = {};
    const retryAttempts: Record<string, number> = {};
    
    this.initializationErrors.forEach((error, entityType) => {
      errorsByEntity[entityType] = error.message;
    });
    
    this.retryAttempts.forEach((attempts, entityType) => {
      retryAttempts[entityType] = attempts;
    });
    
    return {
      totalErrors: this.initializationErrors.size,
      errorsByEntity,
      retryAttempts
    };
  }

  /**
   * Force retry all failed strategy registrations
   */
  retryFailedRegistrations(): void {
    logger.info(`Forcing retry of all failed strategy registrations`, {
      totalErrors: this.initializationErrors.size
    });
    
    // Reset retry attempts to allow new retries
    this.retryAttempts.clear();
    
    // Note: This would require storing original strategy objects
    // For now, just log that manual retry is needed
    this.initializationErrors.forEach((error, entityType) => {
      logger.warn(`Manual strategy re-registration needed for ${entityType}`, {
        entityType,
        lastError: error.message
      });
    });
  }

  /**
   * Execute operation with retry mechanism
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = this.MAX_RETRY_ATTEMPTS
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        
        if (attempt > 0) {
          logger.info(`Operation succeeded after retry`, {
            operation: operationName,
            attempt,
            maxRetries
          });
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < maxRetries) {
          const delay = this.RETRY_DELAY_MS * Math.pow(2, attempt);
          
          logger.warn(`Operation failed, retrying`, {
            operation: operationName,
            attempt: attempt + 1,
            maxRetries,
            error: lastError.message,
            retryDelayMs: delay
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          logger.error(`Operation failed after all retries`, {
            operation: operationName,
            totalAttempts: attempt + 1,
            error: lastError.message
          });
        }
      }
    }
    
    throw lastError!;
  }
}

// Export singleton instance
export const entityDeletionRegistry = EntityDeletionRegistry.getInstance();