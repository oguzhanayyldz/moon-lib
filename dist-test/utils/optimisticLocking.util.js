"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptimisticLockingUtil = void 0;
const logger_service_1 = require("../services/logger.service");
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
class OptimisticLockingUtil {
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
    static async retryWithOptimisticLocking(operation, maxRetries = 5, backoffMs = 100, operationName = 'operation') {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await operation();
                if (attempt > 1) {
                    logger_service_1.logger.info(`${operationName} başarılı (attempt ${attempt}/${maxRetries})`);
                }
                return result;
            }
            catch (error) {
                const isVersionError = error instanceof Error && (error.message.includes('version') ||
                    error.message.includes('VersionError') ||
                    error.message.includes('No matching document found'));
                if (isVersionError && attempt < maxRetries) {
                    const delayMs = backoffMs * Math.pow(2, attempt - 1); // Exponential backoff
                    logger_service_1.logger.warn(`${operationName} version conflict (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                    continue;
                }
                // Son deneme veya version error değilse hatayı fırlat
                logger_service_1.logger.error(`${operationName} failed after ${attempt} attempts:`, error);
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
    static async saveWithRetry(document, operationName, session) {
        const docName = operationName || `Document ${document.id || 'unknown'}`;
        return await this.retryWithOptimisticLocking(async () => {
            const saveOptions = session ? { session } : {};
            await document.save(saveOptions);
            return document;
        }, 5, 100, `${docName} save${session ? ' (transactional)' : ''}`);
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
    static async saveWithContext(document, req, operationName) {
        const session = req && req.dbSession ? req.dbSession : undefined;
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
    static async updateWithRetry(Model, id, updateFields, options = {}, operationName, session) {
        var _a, _b;
        const docName = operationName || `${Model.modelName} ${id}`;
        const result = await this.retryWithOptimisticLocking(async () => {
            const updateOptions = Object.assign(Object.assign({ new: true, omitUndefined: true }, options), (session ? { session } : {}));
            const updatedDoc = await Model.findByIdAndUpdate(id, updateFields, updateOptions);
            if (!updatedDoc) {
                throw new Error(`Document not found: ${id}`);
            }
            return updatedDoc;
        }, 5, 100, `${docName} update${session ? ' (transactional)' : ''}`);
        // ✅ FIX: updateWithRetry ile version set edildiğinde EntityVersionUpdated event publish et
        // Çünkü findByIdAndUpdate post('save') hook'unu tetiklemiyor
        // Her iki format için de çalışır: { version: x } veya { $set: { version: x } }
        const targetVersion = (_b = (_a = updateFields === null || updateFields === void 0 ? void 0 : updateFields.$set) === null || _a === void 0 ? void 0 : _a.version) !== null && _b !== void 0 ? _b : updateFields === null || updateFields === void 0 ? void 0 : updateFields.version;
        if (targetVersion !== undefined && result) {
            try {
                await this.publishVersionEventForUpdate(Model, result, targetVersion);
            }
            catch (error) {
                logger_service_1.logger.error(`❌ Failed to publish version event after updateWithRetry:`, error);
                // Event publish hatası işlemi engellemesin
            }
        }
        return result;
    }
    /**
     * updateWithRetry için EntityVersionUpdated event publish eder
     * @private
     */
    static async publishVersionEventForUpdate(Model, doc, newVersion) {
        var _a, _b;
        const docId = doc.id || ((_a = doc._id) === null || _a === void 0 ? void 0 : _a.toString());
        // ✅ GLOBAL MAP: Config'i Map'ten al
        // base.schema.ts içindeki VERSION_TRACKING_CONFIGS Map'inden config'i oku
        const { VERSION_TRACKING_CONFIGS } = await Promise.resolve().then(() => __importStar(require('../models/base/base.schema')));
        // Model.modelName ile config'i bul - Order, Package, vs.
        // Map key'i entityType ile eşleşmeli (EntityType.Order gibi)
        let config = null;
        for (const [key, value] of VERSION_TRACKING_CONFIGS.entries()) {
            // entityType ile eşleş - 'order', 'package', vs.
            if (key.toLowerCase() === Model.modelName.toLowerCase()) {
                config = value;
                break;
            }
        }
        if (!config || !config.enableVersionTracking) {
            // Version tracking enabled değilse event publish etme (sessizce skip)
            return;
        }
        const versionTrackingConfig = config.versionTrackingConfig;
        if (!versionTrackingConfig) {
            return;
        }
        const { entityType, serviceName } = versionTrackingConfig;
        // Outbox model'i Model'in database connection'ından al
        // Her microservice kendi MongoDB connection'ını kullanıyor
        const Outbox = Model.db.model('Outbox');
        if (!Outbox) {
            logger_service_1.logger.warn(`⚠️ [UPDATE-WITH-RETRY-EVENT] Outbox model not found, skipping event publish`);
            return;
        }
        const previousVersion = newVersion - 1;
        const outboxPayload = {
            eventType: 'entity:version-updated',
            payload: {
                entityType,
                entityId: docId,
                service: serviceName,
                version: newVersion,
                previousVersion,
                timestamp: new Date(),
                userId: ((_b = doc.user) === null || _b === void 0 ? void 0 : _b.toString()) || doc.user,
                metadata: {
                    modelName: Model.modelName,
                    source: 'updateWithRetry'
                }
            },
            status: 'pending'
        };
        await Outbox.create(outboxPayload);
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
    static async updateWithContext(Model, id, updateFields, req, options = {}, operationName) {
        const session = req && req.dbSession ? req.dbSession : undefined;
        return await this.updateWithRetry(Model, id, updateFields, options, operationName, session);
    }
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
    static async updateMetadataWithRetry(Model, id, updateFields, options = {}, operationName, session) {
        const docName = operationName || `${Model.modelName} ${id} metadata`;
        return await this.retryWithOptimisticLocking(async () => {
            const updateOptions = Object.assign(Object.assign({ new: true, omitUndefined: true }, options), (session ? { session } : {}));
            const updatedDoc = await Model.findByIdAndUpdate(id, updateFields, updateOptions);
            if (!updatedDoc) {
                throw new Error(`Document not found: ${id}`);
            }
            return updatedDoc;
        }, 5, 100, `${docName} update${session ? ' (transactional)' : ''}`);
        // ✅ Version tracking event publish YOK - metadata-only update
        // Version increment YOK - post('save') ve post('findOneAndUpdate') hook'ları tetiklenmez
    }
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
    static async updateMetadataWithContext(Model, id, updateFields, req, options = {}, operationName) {
        const session = req && req.dbSession ? req.dbSession : undefined;
        return await this.updateMetadataWithRetry(Model, id, updateFields, options, operationName, session);
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
    static async bulkWithRetry(Model, operations, session, operationName) {
        const opName = operationName || `${Model.modelName} bulk operations`;
        return await this.retryWithOptimisticLocking(async () => {
            const bulkOptions = session ? { session } : {};
            const result = await Model.bulkWrite(operations, bulkOptions);
            return result;
        }, 5, 100, `${opName}${session ? ' (transactional)' : ''}`);
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
    static async bulkWithContext(Model, operations, req, operationName) {
        const session = req && req.dbSession ? req.dbSession : undefined;
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
    static getSessionFromRequest(req) {
        return req && req.dbSession ? req.dbSession : undefined;
    }
    /**
    * Check if operation is running in transaction context
    *
    * @static
    * @param {Request} [req] - Express Request object
    * @return {boolean} True if in transaction context
    */
    static isInTransaction(req) {
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
    static getStats(req) {
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
exports.OptimisticLockingUtil = OptimisticLockingUtil;
//# sourceMappingURL=optimisticLocking.util.js.map