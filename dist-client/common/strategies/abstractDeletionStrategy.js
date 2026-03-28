"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbstractDeletionStrategy = exports.EntityOwnership = exports.DeletionType = void 0;
const logger_service_1 = require("../../services/logger.service");
/**
 * Deletion type enumeration
 */
var DeletionType;
(function (DeletionType) {
    /** Soft delete - mark as deleted but keep in database */
    DeletionType["SOFT"] = "soft";
    /** Hard delete - physically remove from database */
    DeletionType["HARD"] = "hard";
    /** Cascade delete - delete with all dependencies */
    DeletionType["CASCADE"] = "cascade";
})(DeletionType || (exports.DeletionType = DeletionType = {}));
/**
 * Entity ownership type
 */
var EntityOwnership;
(function (EntityOwnership) {
    /** Entity is native to this service */
    EntityOwnership["NATIVE"] = "native";
    /** Entity is a copy from another service */
    EntityOwnership["FOREIGN"] = "foreign";
})(EntityOwnership || (exports.EntityOwnership = EntityOwnership = {}));
/**
 * Abstract base class for entity deletion strategies
 *
 * Provides common functionality and patterns that all deletion strategies
 * can inherit and use. This includes tracing, logging, metrics collection,
 * and error handling.
 *
 * Now supports cross-service deletion patterns:
 * - Native entities: Soft delete (owned by service)
 * - Foreign entities: Hard delete (copies from other services)
 */
class AbstractDeletionStrategy {
    constructor(entityType, serviceName, priority = 1, version = '1.0.0', ownership = EntityOwnership.NATIVE, deletionType = DeletionType.SOFT) {
        this.entityType = entityType;
        this.serviceName = serviceName;
        this.priority = priority;
        this.version = version;
        this.ownership = ownership;
        this.deletionType = deletionType;
        this.logger = logger_service_1.logger;
        // Initialize tracer if available
        try {
            this.tracer = require('../../../tracer').tracer;
        }
        catch (error) {
            // Tracer not available, continue without tracing
            this.tracer = null;
        }
    }
    /**
     * Default implementation checks if the entity type matches
     * Can be overridden for more complex matching logic
     */
    canHandle(entityType, entityId) {
        return entityType === this.entityType;
    }
    /**
     * Default validation implementation
     * Should be overridden by specific strategies for custom validation
     */
    validate(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = {
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
        });
    }
    /**
     * Default rollback implementation (no-op)
     * Can be overridden by strategies that support rollback
     */
    rollback(context, error) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.warn(`Rollback not implemented for ${this.entityType} deletion strategy`, {
                entityType: context.entityType,
                entityId: context.entityId,
                error: error.message
            });
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
    executeWithTracing(operationName, context, operation) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const span = (_a = this.tracer) === null || _a === void 0 ? void 0 : _a.startSpan(operationName);
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
                return yield operation();
            }
            catch (error) {
                if (span) {
                    span.setTag('error', true);
                    span.setTag('error.message', error instanceof Error ? error.message : 'Unknown error');
                }
                throw error;
            }
            finally {
                span === null || span === void 0 ? void 0 : span.finish();
            }
        });
    }
    /**
     * Execute operation with metrics collection
     *
     * @param context Deletion context
     * @param operation The operation to execute
     * @returns Result with metrics included
     */
    executeWithMetrics(context, operation) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const startTime = Date.now();
            let databaseOperations = 0;
            let transactionCount = 0;
            let rollbackOccurred = false;
            try {
                const result = yield operation();
                const endTime = Date.now();
                const metrics = {
                    startTime,
                    endTime,
                    executionTime: endTime - startTime,
                    entitiesProcessed: ((_a = result.deletedEntities) === null || _a === void 0 ? void 0 : _a.length) || 0,
                    databaseOperations,
                    transactionCount: context.transaction ? 1 : 0,
                    rollbackOccurred,
                    serviceName: this.serviceName,
                    strategyName: this.constructor.name
                };
                return Object.assign(Object.assign({}, result), { metrics });
            }
            catch (error) {
                rollbackOccurred = true;
                const endTime = Date.now();
                const failureMetrics = {
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
        });
    }
    /**
     * Execute operation with comprehensive error handling
     *
     * @param context Deletion context
     * @param operation The operation to execute
     * @returns Result of the operation
     */
    executeWithErrorHandling(context, operation) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield operation();
            }
            catch (error) {
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
                        yield this.rollback(context, error);
                        this.logger.info(`Rollback completed for ${this.entityType}`, {
                            entityType: context.entityType,
                            entityId: context.entityId
                        });
                    }
                    catch (rollbackError) {
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
        });
    }
    /**
     * Helper method to create a successful deletion result
     *
     * @param deletedEntities List of deleted entity IDs
     * @param affectedServices List of affected services
     * @param metadata Additional result metadata
     * @returns Successful deletion result
     */
    createSuccessResult(deletedEntities, affectedServices = [this.serviceName], metadata) {
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
    createFailureResult(error, metadata) {
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
    logDeletionOperation(context, result) {
        var _a;
        const logLevel = result.success ? 'info' : 'error';
        this.logger[logLevel](`Entity deletion ${result.success ? 'completed' : 'failed'}`, {
            entityType: context.entityType,
            entityId: context.entityId,
            serviceName: this.serviceName,
            strategy: this.constructor.name,
            success: result.success,
            deletedEntities: result.deletedEntities,
            affectedServices: result.affectedServices,
            executionTime: (_a = result.metrics) === null || _a === void 0 ? void 0 : _a.executionTime,
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
    shouldUseTransaction(context) {
        var _a;
        return Boolean(((_a = context.config) === null || _a === void 0 ? void 0 : _a.useTransactions) &&
            context.transaction);
    }
    /**
     * Get configuration with defaults
     *
     * @param context Deletion context
     * @returns Configuration with default values applied
     */
    getConfigWithDefaults(context) {
        return Object.assign({ useTransactions: false, transactionTimeout: 30000, retryOnTransactionError: true, maxRetries: 3, enableDetailedLogging: false }, context.config);
    }
    /**
     * Determine if this entity is native to the current service
     *
     * @returns Whether the entity is native to this service
     */
    isNativeEntity() {
        return this.ownership === EntityOwnership.NATIVE;
    }
    /**
     * Determine if this entity is foreign (from another service)
     *
     * @returns Whether the entity is foreign
     */
    isForeignEntity() {
        return this.ownership === EntityOwnership.FOREIGN;
    }
    /**
     * Get the deletion method for this entity
     *
     * @returns The deletion type (soft, hard, cascade)
     */
    getDeletionMethod() {
        // Default behavior: Native entities use soft delete, foreign use hard delete
        if (this.deletionType) {
            return this.deletionType;
        }
        return this.isNativeEntity() ? DeletionType.SOFT : DeletionType.HARD;
    }
    /**
     * Determine if this is a cross-service deletion
     *
     * @param context Deletion context
     * @returns Whether this is a cross-service deletion
     */
    isCrossServiceDeletion(context) {
        return context.serviceName !== undefined && context.serviceName !== this.serviceName;
    }
    /**
     * Get the originating service for this entity type
     * Override this method in strategies that handle foreign entities
     *
     * @returns The service that owns this entity type
     */
    getOriginatingService() {
        return this.isNativeEntity() ? this.serviceName : 'unknown';
    }
    /**
     * Validate cross-service deletion permissions
     *
     * @param context Deletion context
     * @returns Whether the deletion is allowed
     */
    validateCrossServiceDeletion(context) {
        // Foreign entities can be deleted by any service
        if (this.isForeignEntity()) {
            return true;
        }
        // Native entities should only be soft-deleted by their owning service
        if (this.isNativeEntity() && context.serviceName === this.serviceName) {
            return true;
        }
        // Log warning for suspicious deletion attempts
        this.logger.warn('Cross-service deletion attempt on native entity', {
            entityType: this.entityType,
            entityId: context.entityId,
            owningService: this.serviceName,
            requestingService: context.serviceName || 'unknown'
        });
        return false;
    }
    /**
     * Helper method to determine deletion options based on ownership
     *
     * @returns Deletion options object for Mongoose operations
     */
    getDeletionOptions() {
        return this.getDeletionMethod() === DeletionType.HARD
            ? { hardDelete: true }
            : {};
    }
}
exports.AbstractDeletionStrategy = AbstractDeletionStrategy;
