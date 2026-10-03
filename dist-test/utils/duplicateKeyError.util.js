"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDuplicateKeyError = isDuplicateKeyError;
const DUPLICATE_KEY_CODE = 11000;
const hasDuplicateKeyCode = (value) => typeof value === 'object' && value !== null && value.code === DUPLICATE_KEY_CODE;
/**
 * MongoDB duplicate key (E11000, kod 11000) hatası olup olmadığını kontrol eder.
 * RetryableListener'ın duplicate-key sınıflandırmasının TEK kaynağıdır; kuralı kopyalayan tüketiciler
 * (ör. inventory OrderCreated) bunu import eder, böylece kural ayrışamaz.
 *
 * Eşleşme Mongo hata koduna dayanır (hata adından bağımsız: MongoError / MongoServerError / mongoose sarmalı):
 * hatanın kendi `code`'u, `writeErrors[].code` (MongoBulkWriteError) veya `result.writeErrors[].code`.
 * Yalnız mesajında "duplicate" geçen hatalar (ör. "duplicate delivery") duplicate-key SAYILMAZ; aksi halde
 * yeniden denemesiz ack'lenip olay kaybolurdu. Mongo'nun kendi "E11000" mesaj belirteci
 * kod taşımayan sarmalanmış hatalar için yedek olarak kalır.
 */
function isDuplicateKeyError(error) {
    if (!(error instanceof Error)) {
        return false;
    }
    if (hasDuplicateKeyCode(error)) {
        return true;
    }
    const { writeErrors, result } = error;
    const bulkErrors = Array.isArray(writeErrors) ? writeErrors : result === null || result === void 0 ? void 0 : result.writeErrors;
    if (Array.isArray(bulkErrors) && bulkErrors.some((e) => hasDuplicateKeyCode(e) || hasDuplicateKeyCode(e === null || e === void 0 ? void 0 : e.err))) {
        return true;
    }
    return /\bE11000\b/.test(error.message);
}
//# sourceMappingURL=duplicateKeyError.util.js.map