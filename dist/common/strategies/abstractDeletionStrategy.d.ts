import { EntityDeletionStrategy, DeletionContext, DeletionResult, DeletionValidationResult } from '../interfaces/entity-deletion.interface';
/**
 * Abstract base class for entity deletion strategies
 *
 * Provides common functionality and patterns that all deletion strategies
 * can inherit and use. This includes tracing, logging, metrics collection,
 * and error handling.
 */
export declare abstract class AbstractDeletionStrategy implements EntityDeletionStrategy {
    readonly entityType: string;
    readonly serviceName: string;
    readonly priority: number;
    readonly version: string;
    protected readonly logger: import("winston").Logger;
    protected tracer: any;
    constructor(entityType: string, serviceName: string, priority?: number, version?: string);
    /**
     * Default implementation checks if the entity type matches
     * Can be overridden for more complex matching logic
     */
    canHandle(entityType: string, entityId: string): boolean;
    /**
     * Default validation implementation
     * Should be overridden by specific strategies for custom validation
     */
    validate(context: DeletionContext): Promise<DeletionValidationResult>;
    /**
     * Abstract method that must be implemented by concrete strategies
     */
    abstract execute(context: DeletionContext): Promise<DeletionResult>;
    /**
     * Default rollback implementation (no-op)
     * Can be overridden by strategies that support rollback
     */
    rollback?(context: DeletionContext, error: Error): Promise<void>;
    /**
     * Execute operation with tracing support
     *
     * @param operationName Name of the operation for tracing
     * @param context Deletion context
     * @param operation The operation to execute
     * @returns Result of the operation
     */
    protected executeWithTracing<T>(operationName: string, context: DeletionContext, operation: () => Promise<T>): Promise<T>;
    /**
     * Execute operation with metrics collection
     *
     * @param context Deletion context
     * @param operation The operation to execute
     * @returns Result with metrics included
     */
    protected executeWithMetrics(context: DeletionContext, operation: () => Promise<DeletionResult>): Promise<DeletionResult>;
    /**
     * Execute operation with comprehensive error handling
     *
     * @param context Deletion context
     * @param operation The operation to execute
     * @returns Result of the operation
     */
    protected executeWithErrorHandling(context: DeletionContext, operation: () => Promise<DeletionResult>): Promise<DeletionResult>;
    /**
     * Helper method to create a successful deletion result
     *
     * @param deletedEntities List of deleted entity IDs
     * @param affectedServices List of affected services
     * @param metadata Additional result metadata
     * @returns Successful deletion result
     */
    protected createSuccessResult(deletedEntities: string[], affectedServices?: string[], metadata?: Record<string, any>): DeletionResult;
    /**
     * Helper method to create a failed deletion result
     *
     * @param error Error message
     * @param metadata Additional result metadata
     * @returns Failed deletion result
     */
    protected createFailureResult(error: string, metadata?: Record<string, any>): DeletionResult;
    /**
     * Log deletion operation details
     *
     * @param context Deletion context
     * @param result Deletion result
     */
    protected logDeletionOperation(context: DeletionContext, result: DeletionResult): void;
    /**
     * Check if transactions are enabled and available
     *
     * @param context Deletion context
     * @returns Whether transactions should be used
     */
    protected shouldUseTransaction(context: DeletionContext): boolean;
    /**
     * Get configuration with defaults
     *
     * @param context Deletion context
     * @returns Configuration with default values applied
     */
    protected getConfigWithDefaults(context: DeletionContext): {
        useTransactions: boolean;
        transactionTimeout: number;
        retryOnTransactionError: boolean;
        maxRetries: number;
        enableDetailedLogging: boolean;
    };
}
