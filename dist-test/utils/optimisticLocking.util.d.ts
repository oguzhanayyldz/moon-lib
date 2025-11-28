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
export declare class OptimisticLockingUtil {
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
    static retryWithOptimisticLocking<T>(operation: () => Promise<T>, maxRetries?: number, backoffMs?: number, operationName?: string): Promise<T>;
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
    static saveWithRetry<T extends {
        save(options?: any): Promise<any>;
        id?: string;
    }>(document: T, operationName?: string, session?: ClientSession): Promise<T>;
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
    static saveWithContext<T extends {
        save(options?: any): Promise<any>;
        id?: string;
    }>(document: T, req?: Request, operationName?: string): Promise<T>;
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
    static updateWithRetry<T>(Model: any, id: string, updateFields: any, options?: any, operationName?: string, session?: ClientSession): Promise<T>;
    /**
     * updateWithRetry için EntityVersionUpdated event publish eder
     * @private
     */
    private static publishVersionEventForUpdate;
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
    static updateWithContext<T>(Model: any, id: string, updateFields: any, req?: Request, options?: any, operationName?: string): Promise<T>;
    /**
    * Metadata güncelleme - VERSION TRACKING OLMADAN
    *
    * Scheduler job'lar, istatistik güncellemeleri ve metadata-only operasyonlar için.
    * Version tracking hook'larını tetiklemez, version increment yapmaz.
    *
    * Use Cases:
    * - AutomationRule: lastRunAt, totalProcessed, totalSuccess, totalFailed
    * - Scheduler metadata: lastExecutedAt, executionCount
    * - Statistics: viewCount, downloadCount, accessCount
    * - Timestamps: lastAccessedAt, lastSyncedAt
    *
    * @static
    * @template T
    * @param {any} Model - Mongoose model
    * @param {string} id - Doküman ID'si
    * @param {any} updateFields - Güncellenecek metadata alanları ($inc, $set, $unset)
    * @param {any} [options={}] - MongoDB update seçenekleri
    * @param {string} [operationName] - İşlem adı (loglama için)
    * @param {ClientSession} [session] - MongoDB session (transaction için)
    * @return {Promise<T>} Güncellenen doküman
    * @description
    * Version tracking hook'unu bypass eder çünkü:
    * - Metadata değişiklikleri anlamlı veri değişikliği değildir
    * - Cross-service sync gerektirmez
    * - Outbox entry oluşturmaya gerek yoktur
    * - Version increment gereksizdir
    *
    * Retry mekanizması ile güvenli güncelleme sağlar:
    * - Exponential backoff stratejisi
    * - Maksimum 5 deneme
    * - Session/transaction desteği
    */
    static updateMetadataWithRetry<T>(Model: any, id: string, updateFields: any, options?: any, operationName?: string, session?: ClientSession): Promise<T>;
    /**
    * Context-aware updateMetadataWithRetry: Request object'ten session algılama
    *
    * @static
    * @template T
    * @param {any} Model - Mongoose model
    * @param {string} id - Doküman ID'si
    * @param {any} updateFields - Güncellenecek metadata alanları
    * @param {Request} [req] - Express Request object (session algılamak için)
    * @param {any} [options={}] - MongoDB update seçenekleri
    * @param {string} [operationName] - İşlem adı (loglama için)
    * @return {Promise<T>} Güncellenen doküman
    * @description Request context'inden session'ı otomatik algılar ve metadata güncelleme yapar.
    */
    static updateMetadataWithContext<T>(Model: any, id: string, updateFields: any, req?: Request, options?: any, operationName?: string): Promise<T>;
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
    static bulkWithRetry<T>(Model: any, operations: any[], session?: ClientSession, operationName?: string): Promise<any>;
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
    static bulkWithContext<T>(Model: any, operations: any[], req?: Request, operationName?: string): Promise<any>;
    /**
    * Session detection utility
    *
    * @static
    * @param {Request} [req] - Express Request object
    * @return {ClientSession | undefined} Detected session or undefined
    * @description Helper method to detect if a session is available in request context.
    */
    static getSessionFromRequest(req?: Request): ClientSession | undefined;
    /**
    * Check if operation is running in transaction context
    *
    * @static
    * @param {Request} [req] - Express Request object
    * @return {boolean} True if in transaction context
    */
    static isInTransaction(req?: Request): boolean;
    /**
    * Get operation statistics
    *
    * @static
    * @param {Request} [req] - Express Request object
    * @return {object} Statistics object
    */
    static getStats(req?: Request): {
        hasSession: boolean;
        inTransaction: boolean;
        sessionId: import("mongodb").ServerSessionId | null | undefined;
        features: {
            sessionAware: boolean;
            contextAware: boolean;
            bulkOperations: boolean;
            optimisticLocking: boolean;
            transactionSupport: boolean;
        };
    };
}
//# sourceMappingURL=optimisticLocking.util.d.ts.map