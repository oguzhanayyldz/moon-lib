"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionControl = exports.getTransactionStats = exports.withReadOnlyTransaction = exports.withBulkTransaction = exports.withConditionalTransaction = exports.withTransaction = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const logger_service_1 = require("../services/logger.service");
/**
 * Cache for replica set status to avoid repeated checks
 */
let isReplicaSetCache = null;
let replicaSetCheckTime = 0;
const REPLICA_SET_CHECK_INTERVAL = 60000; // Re-check every 60 seconds
/**
 * Transaction middleware factory
 *
 * @param options Transaction configuration options
 * @returns Express middleware function
 */
const withTransaction = (options = {}) => {
    const defaultOptions = {
        timeoutMs: 30000, // 30 seconds
        readConcern: 'snapshot',
        writeConcern: { w: 'majority', wtimeout: 30000 },
        readPreference: 'primary'
    };
    const mergedOptions = Object.assign(Object.assign({}, defaultOptions), options);
    return async (req, res, next) => {
        var _a;
        // Skip transaction if explicitly requested
        if (options.skipTransaction) {
            return next();
        }
        // Check if MongoDB is running as a replica set (with caching)
        const now = Date.now();
        if (isReplicaSetCache === null || now - replicaSetCheckTime > REPLICA_SET_CHECK_INTERVAL) {
            try {
                const admin = mongoose_1.default.connection.db.admin();
                await admin.replSetGetStatus();
                isReplicaSetCache = true;
                replicaSetCheckTime = now;
                logger_service_1.logger.info(`✅ Replica set detected - transactions enabled`);
            }
            catch (error) {
                // Not a replica set (standalone MongoDB)
                if (((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('replSet')) || error.codeName === 'NoReplicationEnabled') {
                    isReplicaSetCache = false;
                    replicaSetCheckTime = now;
                    logger_service_1.logger.warn(`⚠️  Standalone MongoDB detected - transactions will be disabled`);
                }
                else {
                    // Different error, rethrow
                    logger_service_1.logger.error(`❌ Error checking replica set status:`, error);
                    throw error;
                }
            }
        }
        // If standalone MongoDB, skip transaction but continue normal flow
        if (!isReplicaSetCache) {
            logger_service_1.logger.debug(`➡️  Processing ${req.method} ${req.originalUrl} without transaction (standalone mode)`);
            return next();
        }
        // Generate transaction ID for tracking
        const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        req.transactionId = transactionId;
        req.transactionStartTime = Date.now();
        logger_service_1.logger.info(`🔵 Transaction started - ID: ${transactionId}, Method: ${req.method}, URL: ${req.originalUrl}`);
        let session = null;
        try {
            // Start MongoDB session
            session = await mongoose_1.default.startSession();
            req.dbSession = session;
            // Start transaction with options
            await session.startTransaction({
                readPreference: mergedOptions.readPreference,
                readConcern: mergedOptions.readConcern,
                writeConcern: mergedOptions.writeConcern,
                maxCommitTimeMS: mergedOptions.timeoutMs
            });
            logger_service_1.logger.debug(`🔄 Transaction context established - ID: ${transactionId}`);
            // Handle response end to commit transaction
            const originalSend = res.send.bind(res);
            const originalJson = res.json.bind(res);
            let transactionHandled = false;
            const handleTransactionSuccess = async () => {
                if (transactionHandled || !session || !session.inTransaction())
                    return;
                transactionHandled = true;
                try {
                    await session.commitTransaction();
                    const duration = Date.now() - req.transactionStartTime;
                    logger_service_1.logger.info(`✅ Transaction committed BEFORE response - ID: ${transactionId}, Duration: ${duration}ms`);
                    // Call custom success handler
                    if (options.onSuccess) {
                        await options.onSuccess(session);
                    }
                }
                catch (commitError) {
                    logger_service_1.logger.error(`❌ Transaction commit failed - ID: ${transactionId}`, commitError);
                    throw commitError;
                }
                finally {
                    await session.endSession();
                }
            };
            // Override response methods to commit BEFORE sending response
            res.send = function (body) {
                // Start commit immediately, then send response
                handleTransactionSuccess()
                    .then(() => {
                    // ✅ Commit successful, send response
                    originalSend(body);
                })
                    .catch((error) => {
                    // ❌ Commit failed, send error response to client
                    logger_service_1.logger.error(`❌ Commit failed, sending error to client - ID: ${transactionId}`, error);
                    res.status(500);
                    originalJson.call(res, {
                        error: 'Transaction commit failed',
                        message: error.message,
                        transactionId: transactionId
                    });
                });
                return res;
            };
            res.json = function (obj) {
                // Start commit immediately, then send response
                handleTransactionSuccess()
                    .then(() => {
                    // ✅ Commit successful, send response
                    originalJson(obj);
                })
                    .catch((error) => {
                    // ❌ Commit failed, send error response to client
                    logger_service_1.logger.error(`❌ Commit failed, sending error to client - ID: ${transactionId}`, error);
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
        }
        catch (error) {
            const duration = Date.now() - req.transactionStartTime;
            logger_service_1.logger.error(`❌ Transaction failed - ID: ${transactionId}, Duration: ${duration}ms`, {
                error: error.message,
                method: req.method,
                url: req.originalUrl,
                stack: error.stack
            });
            // Rollback transaction
            if (session && session.inTransaction()) {
                try {
                    await session.abortTransaction();
                    logger_service_1.logger.info(`🔄 Transaction rolled back - ID: ${transactionId}`);
                }
                catch (rollbackError) {
                    logger_service_1.logger.error(`❌ Transaction rollback failed - ID: ${transactionId}`, rollbackError);
                }
            }
            // Call custom error handler
            if (options.onError && session) {
                try {
                    await options.onError(error, session);
                }
                catch (handlerError) {
                    logger_service_1.logger.error(`❌ Custom error handler failed - ID: ${transactionId}`, handlerError);
                }
            }
            // End session
            if (session) {
                try {
                    await session.endSession();
                }
                catch (endError) {
                    logger_service_1.logger.error(`❌ Session end failed - ID: ${transactionId}`, endError);
                }
            }
            // Re-throw error to be handled by error middleware
            throw error;
        }
    };
};
exports.withTransaction = withTransaction;
/**
 * Conditional transaction middleware
 * Only applies transaction if certain conditions are met
 *
 * @param condition Function that determines if transaction should be applied
 * @param options Transaction configuration options
 * @returns Express middleware function
 */
const withConditionalTransaction = (condition, options = {}) => {
    return (req, res, next) => {
        if (condition(req)) {
            return (0, exports.withTransaction)(options)(req, res, next);
        }
        else {
            return next();
        }
    };
};
exports.withConditionalTransaction = withConditionalTransaction;
/**
 * Transaction middleware for bulk operations
 * Optimized for high-volume operations
 *
 * @param options Transaction configuration options
 * @returns Express middleware function
 */
const withBulkTransaction = (options = {}) => {
    return (0, exports.withTransaction)(Object.assign(Object.assign({}, options), { timeoutMs: options.timeoutMs || 60000, writeConcern: options.writeConcern || { w: 'majority', wtimeout: 60000 } }));
};
exports.withBulkTransaction = withBulkTransaction;
/**
 * Read-only transaction middleware
 * For operations that only read data
 *
 * @param options Transaction configuration options
 * @returns Express middleware function
 */
const withReadOnlyTransaction = (options = {}) => {
    return (0, exports.withTransaction)(Object.assign(Object.assign({}, options), { readConcern: 'snapshot', readPreference: 'secondaryPreferred' }));
};
exports.withReadOnlyTransaction = withReadOnlyTransaction;
/**
 * Get transaction statistics from request
 *
 * @param req Express Request object
 * @returns Transaction statistics
 */
const getTransactionStats = (req) => {
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
exports.getTransactionStats = getTransactionStats;
/**
 * Manual transaction control utilities
 * For advanced use cases where automatic control is not sufficient
 */
exports.TransactionControl = {
    /**
     * Manually commit transaction
     */
    async commit(req) {
        if (req.dbSession && req.dbSession.inTransaction()) {
            await req.dbSession.commitTransaction();
            logger_service_1.logger.info(`🔧 Manual transaction commit - ID: ${req.transactionId}`);
        }
    },
    /**
     * Manually rollback transaction
     */
    async rollback(req) {
        if (req.dbSession && req.dbSession.inTransaction()) {
            await req.dbSession.abortTransaction();
            logger_service_1.logger.info(`🔧 Manual transaction rollback - ID: ${req.transactionId}`);
        }
    },
    /**
     * Create savepoint (if supported by MongoDB in future)
     */
    async savepoint(req, name) {
        // MongoDB doesn't support savepoints yet, but structure is ready
        logger_service_1.logger.debug(`🔖 Savepoint created: ${name} - Transaction: ${req.transactionId}`);
    },
    /**
     * Get current transaction status
     */
    getStatus(req) {
        return (0, exports.getTransactionStats)(req);
    }
};
// Default export
exports.default = exports.withTransaction;
//# sourceMappingURL=transactionMiddleware.js.map