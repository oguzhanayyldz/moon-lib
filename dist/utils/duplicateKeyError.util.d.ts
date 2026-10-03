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
export declare function isDuplicateKeyError(error: unknown): boolean;
