import { logger } from "../services/logger.service";
import { ClientSession } from 'mongoose';
import { Request } from 'express';

/**
 * Enhanced Optimistic Locking Utility
 * 
 * Version conflict durumlarında işlemleri yeniden dener ve
 * MongoDB Atlas Native Transactions ile entegrasyon sağlar.
 * 
 * Özellikler:
 * - Session-aware operasyonlar
 * - Context-aware metodlar (Request object'ten session algılama)
 * - Backward compatibility (mevcut API korunur)
 * - Transaction middleware entegrasyonu
 */
export class OptimisticLockingUtil {
    
    /**
     *
     *
     * @static
     * @template T
     * @param {() => Promise<T>} operation
     * @param {number} [maxRetries=3]
     * @param {number} [backoffMs=100]
     * @param {string} [operationName='operation']
     * @return {*}  {Promise<T>}
     * @memberof OptimisticLockingUtil
     * @description retryWithOptimisticLocking<T>: Versiyon çakışmalarında işlemlerin tekrar denenmesini sağlayan ana fonksiyon. Şu özelliklere sahiptir:
            - Üstel gecikme (exponential backoff) stratejisi kullanır
            - Maksimum yeniden deneme sayısı parametrik olarak ayarlanabilir (varsayılan: 3)
            - İlk gecikme süresi parametrik olarak ayarlanabilir (varsayılan: 100ms)
            - Operasyon adı ile detaylı loglama yapar
            - Session-aware ve transaction-safe operasyon desteği
     */
    static async retryWithOptimisticLocking<T>(
        operation: () => Promise<T>,
        maxRetries: number = 3,
        backoffMs: number = 100,
        operationName: string = 'operation'
    ): Promise<T> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await operation();
                if (attempt > 1) {
                    logger.info(`${operationName} başarılı (attempt ${attempt}/${maxRetries})`);
                }
                return result;
            } catch (error) {
                const isVersionError = error instanceof Error && (
                    error.message.includes('version') ||
                    error.message.includes('VersionError') ||
                    error.message.includes('No matching document found')
                );

                if (isVersionError && attempt < maxRetries) {
                    const delayMs = backoffMs * Math.pow(2, attempt - 1); // Exponential backoff
                    logger.warn(`${operationName} version conflict (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                    continue;
                }
                
                // Son deneme veya version error değilse hatayı fırlat
                logger.error(`${operationName} failed after ${attempt} attempts:`, error);
                throw error;
            }
        }
        
        throw new Error(`${operationName}: Maximum retry attempts (${maxRetries}) reached`);
    }

    /**
    * Session-aware saveWithRetry: MongoDB dokümanını session ile kaydetme
    * 
    * @static
    * @template T
    * @param {T} document - Kaydedilecek doküman
    * @param {string} [operationName] - İşlem adı (loglama için)
    * @param {ClientSession} [session] - MongoDB session (transaction için)
    * @return {Promise<T>} Kaydedilen doküman
    * @description Session-aware doküman kaydetme. Session varsa transaction içinde çalışır.
    */
    static async saveWithRetry<T extends { save(options?: any): Promise<any>; id?: string }>(
        document: T,
        operationName?: string,
        session?: ClientSession
    ): Promise<T> {
        const docName = operationName || `Document ${document.id || 'unknown'}`;
        
        return await this.retryWithOptimisticLocking(
            async () => {
                const saveOptions = session ? { session } : {};
                await document.save(saveOptions);
                return document;
            },
            3,
            100,
            `${docName} save${session ? ' (transactional)' : ''}`
        );
    }

    /**
    * Context-aware saveWithRetry: Request object'ten session algılama
    * 
    * @static
    * @template T
    * @param {T} document - Kaydedilecek doküman
    * @param {Request} [req] - Express Request object (session algılamak için)
    * @param {string} [operationName] - İşlem adı (loglama için)
    * @return {Promise<T>} Kaydedilen doküman
    * @description Request context'inden session'ı otomatik algılar ve transaction'da çalışır.
    */
    static async saveWithContext<T extends { save(options?: any): Promise<any>; id?: string }>(
        document: T,
        req?: Request,
        operationName?: string
    ): Promise<T> {
        const session = req && (req as any).dbSession ? (req as any).dbSession : undefined;
        return await this.saveWithRetry(document, operationName, session);
    }

    /**
    * Session-aware updateWithRetry: MongoDB model güncelleme
    * 
    * @static
    * @template T
    * @param {any} Model - Mongoose model
    * @param {string} id - Doküman ID'si
    * @param {any} updateFields - Güncellenecek alanlar
    * @param {any} [options={}] - MongoDB update seçenekleri
    * @param {string} [operationName] - İşlem adı (loglama için)
    * @param {ClientSession} [session] - MongoDB session (transaction için)
    * @return {Promise<T>} Güncellenen doküman
    * @description Session-aware doküman güncelleme. Session varsa transaction içinde çalışır.
    */
    static async updateWithRetry<T>(
        Model: any,
        id: string,
        updateFields: any,
        options: any = {},
        operationName?: string,
        session?: ClientSession
    ): Promise<T> {
        const docName = operationName || `${Model.modelName} ${id}`;
        
        return await this.retryWithOptimisticLocking(
            async () => {
                const updateOptions = { 
                    new: true, 
                    omitUndefined: true, 
                    ...options,
                    ...(session ? { session } : {})
                };
                
                const result = await Model.findByIdAndUpdate(
                    id, 
                    updateFields, 
                    updateOptions
                );
                
                if (!result) {
                    throw new Error(`Document not found: ${id}`);
                }
                
                return result;
            },
            3,
            100,
            `${docName} update${session ? ' (transactional)' : ''}`
        );
    }

    /**
    * Context-aware updateWithRetry: Request object'ten session algılama
    * 
    * @static
    * @template T
    * @param {any} Model - Mongoose model
    * @param {string} id - Doküman ID'si
    * @param {any} updateFields - Güncellenecek alanlar
    * @param {Request} [req] - Express Request object (session algılamak için)
    * @param {any} [options={}] - MongoDB update seçenekleri
    * @param {string} [operationName] - İşlem adı (loglama için)
    * @return {Promise<T>} Güncellenen doküman
    * @description Request context'inden session'ı otomatik algılar ve transaction'da çalışır.
    */
    static async updateWithContext<T>(
        Model: any,
        id: string,
        updateFields: any,
        req?: Request,
        options: any = {},
        operationName?: string
    ): Promise<T> {
        const session = req && (req as any).dbSession ? (req as any).dbSession : undefined;
        return await this.updateWithRetry(Model, id, updateFields, options, operationName, session);
    }

    /**
    * Bulk operations with session support
    * 
    * @static
    * @template T
    * @param {any} Model - Mongoose model
    * @param {any[]} operations - Bulk operations array
    * @param {ClientSession} [session] - MongoDB session (transaction için)
    * @param {string} [operationName] - İşlem adı (loglama için)
    * @return {Promise<any>} Bulk operation result
    * @description Bulk operations for better performance with session support.
    */
    static async bulkWithRetry<T>(
        Model: any,
        operations: any[],
        session?: ClientSession,
        operationName?: string
    ): Promise<any> {
        const opName = operationName || `${Model.modelName} bulk operations`;
        
        return await this.retryWithOptimisticLocking(
            async () => {
                const bulkOptions = session ? { session } : {};
                const result = await Model.bulkWrite(operations, bulkOptions);
                return result;
            },
            3,
            100,
            `${opName}${session ? ' (transactional)' : ''}`
        );
    }

    /**
    * Context-aware bulk operations
    * 
    * @static
    * @template T
    * @param {any} Model - Mongoose model
    * @param {any[]} operations - Bulk operations array
    * @param {Request} [req] - Express Request object (session algılamak için)
    * @param {string} [operationName] - İşlem adı (loglama için)
    * @return {Promise<any>} Bulk operation result
    */
    static async bulkWithContext<T>(
        Model: any,
        operations: any[],
        req?: Request,
        operationName?: string
    ): Promise<any> {
        const session = req && (req as any).dbSession ? (req as any).dbSession : undefined;
        return await this.bulkWithRetry(Model, operations, session, operationName);
    }

    /**
    * Session detection utility
    * 
    * @static
    * @param {Request} [req] - Express Request object
    * @return {ClientSession | undefined} Detected session or undefined
    * @description Helper method to detect if a session is available in request context.
    */
    static getSessionFromRequest(req?: Request): ClientSession | undefined {
        return req && (req as any).dbSession ? (req as any).dbSession : undefined;
    }

    /**
    * Check if operation is running in transaction context
    * 
    * @static
    * @param {Request} [req] - Express Request object
    * @return {boolean} True if in transaction context
    */
    static isInTransaction(req?: Request): boolean {
        const session = this.getSessionFromRequest(req);
        return session ? session.inTransaction() : false;
    }

    /**
    * Get operation statistics
    * 
    * @static
    * @param {Request} [req] - Express Request object
    * @return {object} Statistics object
    */
    static getStats(req?: Request) {
        const session = this.getSessionFromRequest(req);
        return {
            hasSession: !!session,
            inTransaction: session ? session.inTransaction() : false,
            sessionId: session ? session.id : null,
            features: {
                sessionAware: true,
                contextAware: true,
                bulkOperations: true,
                optimisticLocking: true,
                transactionSupport: true
            }
        };
    }
}