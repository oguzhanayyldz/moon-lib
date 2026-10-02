"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDuplicateKeyError = isDuplicateKeyError;
/**
 * MongoDB duplicate key hatası olup olmadığını kontrol eder.
 * RetryableListener'ın duplicate-key sınıflandırmasının TEK kaynağıdır; kuralı kopyalayan tüketiciler
 * (ör. inventory OrderCreated) bunu import eder, böylece kural ayrışamaz.
 */
function isDuplicateKeyError(error) {
    if (error instanceof Error) {
        // MongoDB hata kodu 11000 duplicate key hatası
        if (error.name === 'MongoError' && error.code === 11000) {
            return true;
        }
        // Hata mesajında duplicate key ifadesi var mı?
        if (error.message.includes('duplicate key') ||
            error.message.includes('E11000') ||
            error.message.includes('duplicate') ||
            error.message.includes('uniqueCode')) {
            return true;
        }
    }
    return false;
}
//# sourceMappingURL=duplicateKeyError.util.js.map