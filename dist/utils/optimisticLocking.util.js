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
exports.OptimisticLockingUtil = void 0;
const logger_service_1 = require("../services/logger.service");
/**
 * Optimistic locking için retry utility fonksiyonu
 * Version conflict durumlarında işlemi yeniden dener
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
            Üstel gecikme (exponential backoff) stratejisi kullanır
            Maksimum yeniden deneme sayısı parametrik olarak ayarlanabilir (varsayılan: 3)
            İlk gecikme süresi parametrik olarak ayarlanabilir (varsayılan: 100ms)
            Operasyon adı ile detaylı loglama yapar
     */
    static retryWithOptimisticLocking(operation_1) {
        return __awaiter(this, arguments, void 0, function* (operation, maxRetries = 3, backoffMs = 100, operationName = 'operation') {
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const result = yield operation();
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
                        yield new Promise(resolve => setTimeout(resolve, delayMs));
                        continue;
                    }
                    // Son deneme veya version error değilse hatayı fırlat
                    logger_service_1.logger.error(`${operationName} failed after ${attempt} attempts:`, error);
                    throw error;
                }
            }
            throw new Error(`${operationName}: Maximum retry attempts (${maxRetries}) reached`);
        });
    }
    /**
    *
    *
    * @static
    * @template T
    * @param {T} document
    * @param {string} [operationName]
    * @return {*}  {Promise<T>}
    * @memberof OptimisticLockingUtil
    * @description saveWithRetry<T>: Bir MongoDB dokümanını kaydetmek için optimize edilmiş retry mekanizması.
            Doküman save() işlemini yeniden deneme mantığı ile güçlendirir
            İşlem adını ve doküman ID'sini loglama için kullanır
    */
    static saveWithRetry(document, operationName) {
        return __awaiter(this, void 0, void 0, function* () {
            const docName = operationName || `Document ${document.id || 'unknown'}`;
            return yield this.retryWithOptimisticLocking(() => __awaiter(this, void 0, void 0, function* () {
                yield document.save();
                return document;
            }), 3, 100, `${docName} save`);
        });
    }
    /**
    *
    *
    * @static
    * @template T
    * @param {any} Model
    * @param {string} id
    * @param {any} updateFields
    * @param {any} [options={}]
    * @param {string} [operationName]
    * @return {*}  {Promise<T>}
    * @memberof OptimisticLockingUtil
    * @description updateWithRetry<T>: findByIdAndUpdate işlemi için özel retry mekanizması.
            Belirli bir ID ile doküman güncellemelerinde kullanılır
            omitUndefined ve new:true gibi yaygın MongoDB seçeneklerini varsayılan olarak sunar
            Doküman bulunamazsa uygun hata fırlatır
    */
    static updateWithRetry(Model_1, id_1, updateFields_1) {
        return __awaiter(this, arguments, void 0, function* (Model, id, updateFields, options = {}, operationName) {
            const docName = operationName || `${Model.modelName} ${id}`;
            return yield this.retryWithOptimisticLocking(() => __awaiter(this, void 0, void 0, function* () {
                const result = yield Model.findByIdAndUpdate(id, updateFields, Object.assign({ new: true, omitUndefined: true }, options));
                if (!result) {
                    throw new Error(`Document not found: ${id}`);
                }
                return result;
            }), 3, 100, `${docName} update`);
        });
    }
}
exports.OptimisticLockingUtil = OptimisticLockingUtil;
