import { Request, Response, NextFunction } from 'express';
import mongoose, { ClientSession } from 'mongoose';
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
    readConcern?: string;
    /** Write concern options */
    writeConcern?: any;
    /** Read preference */
    readPreference?: string;
    /** Skip transaction for specific operations */
    skipTransaction?: boolean;
    /** Custom error handler */
    onError?: (error: Error, session: ClientSession) => Promise<void>;
    /** Custom success handler */
    onSuccess?: (session: ClientSession) => Promise<void>;
}
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
export declare const withTransaction: (options?: TransactionOptions) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Conditional transaction middleware
 * Only applies transaction if certain conditions are met
 *
 * @param condition Function that determines if transaction should be applied
 * @param options Transaction configuration options
 * @returns Express middleware function
 */
export declare const withConditionalTransaction: (condition: (req: Request) => boolean, options?: TransactionOptions) => (req: Request, res: Response, next: NextFunction) => void | Promise<void>;
/**
 * Transaction middleware for bulk operations
 * Optimized for high-volume operations
 *
 * @param options Transaction configuration options
 * @returns Express middleware function
 */
export declare const withBulkTransaction: (options?: TransactionOptions) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Read-only transaction middleware
 * For operations that only read data
 *
 * @param options Transaction configuration options
 * @returns Express middleware function
 */
export declare const withReadOnlyTransaction: (options?: TransactionOptions) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Get transaction statistics from request
 *
 * @param req Express Request object
 * @returns Transaction statistics
 */
export declare const getTransactionStats: (req: Request) => {
    transactionId: string | undefined;
    hasSession: boolean;
    inTransaction: boolean;
    duration: number;
    sessionId: mongoose.mongo.ServerSessionId | null | undefined;
    features: {
        autoCommit: boolean;
        autoRollback: boolean;
        performanceTracking: boolean;
        errorHandling: boolean;
        conditionalTransactions: boolean;
    };
};
/**
 * Manual transaction control utilities
 * For advanced use cases where automatic control is not sufficient
 */
export declare const TransactionControl: {
    /**
     * Manually commit transaction
     */
    commit(req: Request): Promise<void>;
    /**
     * Manually rollback transaction
     */
    rollback(req: Request): Promise<void>;
    /**
     * Create savepoint (if supported by MongoDB in future)
     */
    savepoint(req: Request, name: string): Promise<void>;
    /**
     * Get current transaction status
     */
    getStatus(req: Request): {
        transactionId: string | undefined;
        hasSession: boolean;
        inTransaction: boolean;
        duration: number;
        sessionId: mongoose.mongo.ServerSessionId | null | undefined;
        features: {
            autoCommit: boolean;
            autoRollback: boolean;
            performanceTracking: boolean;
            errorHandling: boolean;
            conditionalTransactions: boolean;
        };
    };
};
export default withTransaction;
