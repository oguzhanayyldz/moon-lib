/**
 * MongoDB duplicate key hatası olup olmadığını kontrol eder.
 * RetryableListener'ın duplicate-key sınıflandırmasının TEK kaynağıdır; kuralı kopyalayan tüketiciler
 * (ör. inventory OrderCreated) bunu import eder, böylece kural ayrışamaz.
 */
export declare function isDuplicateKeyError(error: unknown): boolean;
//# sourceMappingURL=duplicateKeyError.util.d.ts.map