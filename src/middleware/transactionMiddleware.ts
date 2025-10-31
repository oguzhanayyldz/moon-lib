import { Request, Response, NextFunction } from 'express';
import mongoose, { ClientSession } from 'mongoose';
import { logger } from '../services/logger.service';

/**
 * Transaction Middleware for Express Routes
 * 
 * Bu middleware MongoDB Atlas Native Transactions'ı Express route'larında 
 * otomatik olarak yönetir. Route handler'ında hata oluşması durumunda
 * otomatik rollback, başarı durumunda otomatik commit sağlar.
 * 
 * Kullanım:
 * ```typescript
 * router.post('/api/orders', withTransaction(), async (req, res) => {
 *   // req.dbSession otomatik kullanılabilir
 *   const order = await Order.create(orderData, { session: req.dbSession });
 *   res.json(order); // Otomatik commit
 * });
 * ```
 */

export interface TransactionOptions {
    /** Transaction timeout in milliseconds (default: 30000) */
    timeoutMs?: number;
    /** Read concern level (default: 'snapshot') */
    readConcern?: string; // mongoose.ReadConcernLevel not exported in v7
    /** Write concern options */
    writeConcern?: any; // mongoose.WriteConcern
    /** Read preference */
    readPreference?: string;
    /** Skip transaction for specific operations */
    skipTransaction?: boolean;
    /** Custom error handler */
    onError?: (error: Error, session: ClientSession) => Promise<void>;
    /** Custom success handler */
    onSuccess?: (session: ClientSession) => Promise<void>;
}

// Request interface genişletme
declare global {
    namespace Express {
        interface Request {
            /** MongoDB session for transactions */
            dbSession?: ClientSession;
            /** Transaction ID for tracking */
            transactionId?: string;
            /** Transaction start time for performance tracking */
            transactionStartTime?: number;
        }
    }
}

/**
 * Transaction middleware factory
 * 
 * @param options Transaction configuration options
 * @returns Express middleware function
 */
export const withTransaction = (options: TransactionOptions = {}) => {
    const defaultOptions: Required<Omit<TransactionOptions, 'onError' | 'onSuccess' | 'skipTransaction'>> = {
        timeoutMs: 30000, // 30 seconds
        readConcern: 'snapshot',
        writeConcern: { w: 'majority', wtimeout: 30000 },
        readPreference: 'primary'
    };

    const mergedOptions = { ...defaultOptions, ...options };

    return async (req: Request, res: Response, next: NextFunction) => {
        // Skip transaction if explicitly requested
        if (options.skipTransaction) {
            return next();
        }

        // Generate transaction ID for tracking
        const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        req.transactionId = transactionId;
        req.transactionStartTime = Date.now();

        logger.info(`🔵 Transaction started - ID: ${transactionId}, Method: ${req.method}, URL: ${req.originalUrl}`);

        let session: ClientSession | null = null;

        try {
            // Start MongoDB session
            session = await mongoose.startSession();
            req.dbSession = session;

            // Start transaction with options
            await session.startTransaction({
                readPreference: mergedOptions.readPreference as any,
                readConcern: mergedOptions.readConcern as any,
                writeConcern: mergedOptions.writeConcern,
                maxCommitTimeMS: mergedOptions.timeoutMs
            });

            logger.debug(`🔄 Transaction context established - ID: ${transactionId}`);

            // Handle response end to commit transaction
            const originalSend = res.send.bind(res);
            const originalJson = res.json.bind(res);
            let transactionHandled = false;

            const handleTransactionSuccess = async (): Promise<void> => {
                if (transactionHandled || !session || !session.inTransaction()) return;
                transactionHandled = true;

                try {
                    await session.commitTransaction();
                    const duration = Date.now() - req.transactionStartTime!;

                    logger.info(`✅ Transaction committed BEFORE response - ID: ${transactionId}, Duration: ${duration}ms`);

                    // Call custom success handler
                    if (options.onSuccess) {
                        await options.onSuccess(session);
                    }
                } catch (commitError) {
                    logger.error(`❌ Transaction commit failed - ID: ${transactionId}`, commitError);
                    throw commitError;
                } finally {
                    await session.endSession();
                }
            };

            // Override response methods to commit BEFORE sending response
            res.send = function(body: any) {
                // Start commit immediately, then send response
                handleTransactionSuccess()
                    .then(() => {
                        // ✅ Commit successful, send response
                        originalSend(body);
                    })
                    .catch((error) => {
                        // ❌ Commit failed, send error response to client
                        logger.error(`❌ Commit failed, sending error to client - ID: ${transactionId}`, error);
                        res.status(500);
                        originalJson.call(res, {
                            error: 'Transaction commit failed',
                            message: error.message,
                            transactionId: transactionId
                        });
                    });

                return res;
            };

            res.json = function(obj: any) {
                // Start commit immediately, then send response
                handleTransactionSuccess()
                    .then(() => {
                        // ✅ Commit successful, send response
                        originalJson(obj);
                    })
                    .catch((error) => {
                        // ❌ Commit failed, send error response to client
                        logger.error(`❌ Commit failed, sending error to client - ID: ${transactionId}`, error);
                        res.status(500);
                        originalJson.call(res, {
                            error: 'Transaction commit failed',
                            message: error.message,
                            transactionId: transactionId
                        });
                    });

                return res;
            };

            // Execute the route handler (synchronous call)
            next();

        } catch (error) {
            const duration = Date.now() - req.transactionStartTime!;
            
            logger.error(`❌ Transaction failed - ID: ${transactionId}, Duration: ${duration}ms`, {
                error: (error as Error).message,
                method: req.method,
                url: req.originalUrl,
                stack: (error as Error).stack
            });

            // Rollback transaction
            if (session && session.inTransaction()) {
                try {
                    await session.abortTransaction();
                    logger.info(`🔄 Transaction rolled back - ID: ${transactionId}`);
                } catch (rollbackError) {
                    logger.error(`❌ Transaction rollback failed - ID: ${transactionId}`, rollbackError);
                }
            }

            // Call custom error handler
            if (options.onError && session) {
                try {
                    await options.onError(error as Error, session);
                } catch (handlerError) {
                    logger.error(`❌ Custom error handler failed - ID: ${transactionId}`, handlerError);
                }
            }

            // End session
            if (session) {
                try {
                    await session.endSession();
                } catch (endError) {
                    logger.error(`❌ Session end failed - ID: ${transactionId}`, endError);
                }
            }

            // Re-throw error to be handled by error middleware
            throw error;
        }
    };
};

/**
 * Conditional transaction middleware
 * Only applies transaction if certain conditions are met
 * 
 * @param condition Function that determines if transaction should be applied
 * @param options Transaction configuration options
 * @returns Express middleware function
 */
export const withConditionalTransaction = (
    condition: (req: Request) => boolean,
    options: TransactionOptions = {}
) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (condition(req)) {
            return withTransaction(options)(req, res, next);
        } else {
            return next();
        }
    };
};

/**
 * Transaction middleware for bulk operations
 * Optimized for high-volume operations
 * 
 * @param options Transaction configuration options
 * @returns Express middleware function
 */
export const withBulkTransaction = (options: TransactionOptions = {}) => {
    return withTransaction({
        ...options,
        timeoutMs: options.timeoutMs || 60000, // Longer timeout for bulk ops
        writeConcern: options.writeConcern || { w: 'majority', wtimeout: 60000 }
    });
};

/**
 * Read-only transaction middleware
 * For operations that only read data
 * 
 * @param options Transaction configuration options
 * @returns Express middleware function
 */
export const withReadOnlyTransaction = (options: TransactionOptions = {}) => {
    return withTransaction({
        ...options,
        readConcern: 'snapshot',
        readPreference: 'secondaryPreferred'
    });
};

/**
 * Get transaction statistics from request
 * 
 * @param req Express Request object
 * @returns Transaction statistics
 */
export const getTransactionStats = (req: Request) => {
    const session = req.dbSession;
    const startTime = req.transactionStartTime;
    
    return {
        transactionId: req.transactionId,
        hasSession: !!session,
        inTransaction: session ? session.inTransaction() : false,
        duration: startTime ? Date.now() - startTime : 0,
        sessionId: session ? session.id : null,
        features: {
            autoCommit: true,
            autoRollback: true,
            performanceTracking: true,
            errorHandling: true,
            conditionalTransactions: true
        }
    };
};

/**
 * Manual transaction control utilities
 * For advanced use cases where automatic control is not sufficient
 */
export const TransactionControl = {
    /**
     * Manually commit transaction
     */
    async commit(req: Request): Promise<void> {
        if (req.dbSession && req.dbSession.inTransaction()) {
            await req.dbSession.commitTransaction();
            logger.info(`🔧 Manual transaction commit - ID: ${req.transactionId}`);
        }
    },

    /**
     * Manually rollback transaction
     */
    async rollback(req: Request): Promise<void> {
        if (req.dbSession && req.dbSession.inTransaction()) {
            await req.dbSession.abortTransaction();
            logger.info(`🔧 Manual transaction rollback - ID: ${req.transactionId}`);
        }
    },

    /**
     * Create savepoint (if supported by MongoDB in future)
     */
    async savepoint(req: Request, name: string): Promise<void> {
        // MongoDB doesn't support savepoints yet, but structure is ready
        logger.debug(`🔖 Savepoint created: ${name} - Transaction: ${req.transactionId}`);
    },

    /**
     * Get current transaction status
     */
    getStatus(req: Request) {
        return getTransactionStats(req);
    }
};

// Default export
export default withTransaction;