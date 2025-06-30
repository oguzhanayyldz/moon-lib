import mongoose, { ClientSession } from 'mongoose';
import { logger } from '../services/logger.service';

/**
 * MongoDB Atlas Native Transaction Manager
 * 
 * This service provides MongoDB Atlas native transaction capabilities,
 * building upon the existing OptimisticLockingUtil foundation.
 * 
 * Key Features:
 * - ACID compliance guaranteed cross-service operations
 * - Built-in rollback and error handling
 * - Session management with automatic cleanup
 * - Performance optimized for MongoDB Atlas
 * - Compatible with existing moon-lib architecture
 */

export interface TransactionOperation {
    id: string;
    execute: (session: ClientSession) => Promise<any>;
    isResultOperation?: boolean;
}

export interface TransactionOptions {
    timeoutMs?: number;
    readConcern?: mongoose.ReadConcernLevel;
    writeConcern?: mongoose.WriteConcern;
    readPreference?: string;
}

export interface TransactionResult<T = any> {
    success: boolean;
    result?: T;
    error?: Error;
    operationsExecuted: string[];
    transactionId: string;
    duration: number;
}

export class MongoTransactionManager {
    private static instance: MongoTransactionManager;
    private connection: mongoose.Connection;
    
    // Default transaction options
    private defaultOptions: Required<TransactionOptions> = {
        timeoutMs: 30000, // 30 seconds
        readConcern: 'snapshot',
        writeConcern: { w: 'majority', wtimeout: 30000 },
        readPreference: 'primary'
    };

    private constructor(connection?: mongoose.Connection) {
        // Use provided connection or default to mongoose.connection
        this.connection = connection || mongoose.connection;
    }

    public static getInstance(connection?: mongoose.Connection): MongoTransactionManager {
        if (!MongoTransactionManager.instance) {
            MongoTransactionManager.instance = new MongoTransactionManager(connection);
        }
        return MongoTransactionManager.instance;
    }

    /**
     * Execute a cross-service atomic transaction
     * 
     * @example
     * ```typescript
     * const result = await transactionManager.executeTransaction(
     *   'order_creation_' + Date.now(),
     *   [
     *     {
     *       id: 'check_inventory',
     *       execute: async (session) => {
     *         const inventory = await Inventory.findOne({ productId }, null, { session });
     *         if (!inventory || inventory.availableStock < quantity) {
     *           throw new Error('Insufficient stock');
     *         }
     *       }
     *     },
     *     {
     *       id: 'create_order',
     *       isResultOperation: true,
     *       execute: async (session) => {
     *         const order = new Order(orderData);
     *         return await order.save({ session });
     *       }
     *     },
     *     {
     *       id: 'update_inventory',
     *       execute: async (session) => {
     *         await Inventory.updateOne(
     *           { productId },
     *           { $inc: { availableStock: -quantity } },
     *           { session }
     *         );
     *       }
     *     }
     *   ]
     * );
     * ```
     */
    async executeTransaction<T = any>(
        transactionId: string,
        operations: TransactionOperation[],
        options: TransactionOptions = {}
    ): Promise<TransactionResult<T>> {
        const startTime = Date.now();
        const mergedOptions = { ...this.defaultOptions, ...options };
        const operationsExecuted: string[] = [];
        
        logger.info(`🔵 MongoDB Transaction started - ID: ${transactionId}, Operations: ${operations.length}`);

        const session = await this.connection.startSession();

        try {
            const result = await session.withTransaction(async () => {
                let transactionResult: any;

                // Execute operations sequentially within transaction
                for (const operation of operations) {
                    try {
                        logger.debug(`🔄 Executing operation: ${operation.id} - Transaction: ${transactionId}`);
                        
                        const stepResult = await operation.execute(session);
                        operationsExecuted.push(operation.id);

                        // Store result if this is the designated result operation
                        if (operation.isResultOperation) {
                            transactionResult = stepResult;
                        }

                        logger.debug(`✅ Operation completed: ${operation.id} - Transaction: ${transactionId}`);
                    } catch (operationError) {
                        logger.error(`❌ Operation failed: ${operation.id} - Transaction: ${transactionId}`, operationError);
                        throw operationError;
                    }
                }

                return transactionResult;
            }, {
                readPreference: mergedOptions.readPreference as any,
                readConcern: { level: mergedOptions.readConcern },
                writeConcern: mergedOptions.writeConcern,
                maxCommitTimeMS: mergedOptions.timeoutMs
            });

            const duration = Date.now() - startTime;
            
            logger.info(`✅ MongoDB Transaction completed successfully - ID: ${transactionId}, Operations: ${operationsExecuted.length}/${operations.length}, Duration: ${duration}ms`);

            return {
                success: true,
                result,
                operationsExecuted,
                transactionId,
                duration
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            
            logger.error(`❌ MongoDB Transaction failed - ID: ${transactionId}, Operations executed: ${operationsExecuted.length}/${operations.length}, Duration: ${duration}ms`, {
                error: (error as Error).message,
                operationsExecuted,
                transactionId
            });

            return {
                success: false,
                error: error as Error,
                operationsExecuted,
                transactionId,
                duration
            };
        } finally {
            await session.endSession();
            logger.debug(`🔓 Transaction session ended - ID: ${transactionId}`);
        }
    }

    /**
     * Execute a simple transaction with automatic session management
     * 
     * @example
     * ```typescript
     * const order = await transactionManager.withTransaction(async (session) => {
     *   // Check inventory
     *   const inventory = await Inventory.findOne({ productId }, null, { session });
     *   if (!inventory || inventory.availableStock < quantity) {
     *     throw new Error('Insufficient stock');
     *   }
     *   
     *   // Create order
     *   const order = new Order(orderData);
     *   const savedOrder = await order.save({ session });
     *   
     *   // Update inventory
     *   await Inventory.updateOne(
     *     { productId },
     *     { $inc: { availableStock: -quantity } },
     *     { session }
     *   );
     *   
     *   return savedOrder;
     * });
     * ```
     */
    async withTransaction<T>(
        operation: (session: ClientSession) => Promise<T>,
        options: TransactionOptions = {}
    ): Promise<T> {
        const transactionId = `simple_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const mergedOptions = { ...this.defaultOptions, ...options };
        
        logger.info(`🔵 Simple MongoDB Transaction started - ID: ${transactionId}`);

        const session = await this.connection.startSession();

        try {
            const result = await session.withTransaction(operation, {
                readPreference: mergedOptions.readPreference as any,
                readConcern: { level: mergedOptions.readConcern },
                writeConcern: mergedOptions.writeConcern,
                maxCommitTimeMS: mergedOptions.timeoutMs
            });

            logger.info(`✅ Simple MongoDB Transaction completed - ID: ${transactionId}`);
            return result;
        } catch (error) {
            logger.error(`❌ Simple MongoDB Transaction failed - ID: ${transactionId}`, error);
            throw error;
        } finally {
            await session.endSession();
            logger.debug(`🔓 Simple transaction session ended - ID: ${transactionId}`);
        }
    }

    /**
     * Get transaction manager statistics
     */
    getStats() {
        return {
            defaultOptions: this.defaultOptions,
            mongooseConnectionState: this.connection.readyState,
            mongooseConnectionName: this.connection.name,
            connectionHost: this.connection.host,
            connectionPort: this.connection.port,
            features: {
                multiDocumentTransactions: true,
                changeStreams: true,
                sessionSupport: true,
                optimisticLocking: true,
                retryableWrites: true
            }
        };
    }
}

// Export singleton instance factory (deprecated - services should create their own instances)
export const transactionManager = MongoTransactionManager.getInstance();

/**
 * Enhanced OptimisticLocking utility with transaction support
 * This extends the existing OptimisticLockingUtil with session-aware operations
 */
export class TransactionAwareOptimisticLocking {
    /**
     * Save with retry and optional session support
     */
    static async saveWithRetry<T extends mongoose.Document>(
        document: T,
        description?: string,
        session?: ClientSession,
        maxRetries: number = 3
    ): Promise<T> {
        const { OptimisticLockingUtil } = await import('../utils/optimisticLocking.util');
        
        if (session) {
            // Use session-aware save
            return await document.save({ session });
        } else {
            // Fall back to existing OptimisticLockingUtil
            return await OptimisticLockingUtil.saveWithRetry(document, description, maxRetries);
        }
    }

    /**
     * Update with retry and optional session support
     */
    static async updateWithRetry<T extends mongoose.Document>(
        model: mongoose.Model<T>,
        id: string,
        updateData: any,
        session?: ClientSession,
        maxRetries: number = 3
    ): Promise<T | null> {
        const { OptimisticLockingUtil } = await import('../utils/optimisticLocking.util');
        
        if (session) {
            // Use session-aware update
            return await model.findByIdAndUpdate(id, updateData, { 
                new: true, 
                session,
                runValidators: true 
            });
        } else {
            // Fall back to existing OptimisticLockingUtil
            return await OptimisticLockingUtil.updateWithRetry(model, id, updateData, maxRetries);
        }
    }
}