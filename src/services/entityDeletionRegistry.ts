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
   * Register a deletion strategy for an entity type
   */
  register(strategy: EntityDeletionStrategy): void {
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
   * Resolve the best strategy for an entity type
   */
  resolve(entityType: string): EntityDeletionStrategy | null {
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
   * Execute entity deletion with automatic strategy resolution
   */
  async execute(context: DeletionContext): Promise<DeletionResult> {
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
   * Execute entity deletion without transaction
   */
  async executeWithoutTransaction(context: DeletionContext): Promise<DeletionResult> {
    const strategy = this.resolve(context.entityType);
    
    if (!strategy) {
      return {
        success: false,
        deletedEntities: [],
        affectedServices: [],
        error: `No deletion strategy found for entity type: ${context.entityType}`
      };
    }

    logger.info(`Executing entity deletion without transaction`, {
      entityType: context.entityType,
      entityId: context.entityId,
      serviceName: strategy.serviceName,
      strategy: strategy.constructor.name
    });

    try {
      // Validate before execution
      const validation = await strategy.validate(context);
      
      if (!validation.isValid) {
        return {
          success: false,
          deletedEntities: [],
          affectedServices: [strategy.serviceName],
          error: `Validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Execute deletion
      const result = await strategy.execute(context);
      
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
      
      logger.error('Entity deletion failed', {
        entityType: context.entityType,
        entityId: context.entityId,
        serviceName: strategy.serviceName,
        error: errorMessage
      });

      return {
        success: false,
        deletedEntities: [],
        affectedServices: [strategy.serviceName],
        error: errorMessage
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
    logger.info('Cleared all registered deletion strategies');
  }

  /**
   * Check if transaction manager is available
   */
  isTransactionManagerAvailable(): boolean {
    return Boolean(this.transactionManager);
  }
}

// Export singleton instance
export const entityDeletionRegistry = EntityDeletionRegistry.getInstance();