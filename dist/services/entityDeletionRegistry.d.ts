import { EntityDeletionStrategy, IEntityDeletionRegistry, DeletionContext, DeletionResult } from '../common/interfaces/entity-deletion.interface';
/**
 * Registry for managing entity deletion strategies
 *
 * This singleton class manages the registration and resolution of entity deletion
 * strategies across all services. It provides a centralized way to handle entity
 * deletions with support for both transaction-based and non-transaction operations.
 */
export declare class EntityDeletionRegistry implements IEntityDeletionRegistry {
    private static instance;
    private strategies;
    private transactionManager;
    private constructor();
    /**
     * Get the singleton instance of the registry
     */
    static getInstance(): EntityDeletionRegistry;
    /**
     * Register a deletion strategy for an entity type
     */
    register(strategy: EntityDeletionStrategy): void;
    /**
     * Unregister a deletion strategy
     */
    unregister(entityType: string, serviceName?: string): void;
    /**
     * Resolve the best strategy for an entity type
     */
    resolve(entityType: string): EntityDeletionStrategy | null;
    /**
     * Get all registered strategies
     */
    getAllStrategies(): Map<string, EntityDeletionStrategy[]>;
    /**
     * Execute entity deletion with automatic strategy resolution
     */
    execute(context: DeletionContext): Promise<DeletionResult>;
    /**
     * Execute entity deletion with transaction support
     */
    executeWithTransaction(context: DeletionContext): Promise<DeletionResult>;
    /**
     * Execute entity deletion without transaction
     */
    executeWithoutTransaction(context: DeletionContext): Promise<DeletionResult>;
    /**
     * Check if a strategy is registered for an entity type
     */
    hasStrategy(entityType: string): boolean;
    /**
     * Get statistics about registered strategies
     */
    getStats(): {
        totalStrategies: number;
        entitiesSupported: string[];
        servicesInvolved: string[];
    };
    /**
     * Clear all registered strategies (for testing purposes)
     */
    clear(): void;
    /**
     * Check if transaction manager is available
     */
    isTransactionManagerAvailable(): boolean;
}
export declare const entityDeletionRegistry: EntityDeletionRegistry;
