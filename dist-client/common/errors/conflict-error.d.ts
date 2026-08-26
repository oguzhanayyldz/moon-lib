import { CustomError } from "./custom-error";
/**
 * 409 Conflict — istek mevcut kaynak durumuyla çelişiyor (issue #637)
 *
 * NEDEN 400 DEĞİL: İstek biçimsel olarak geçerli ve yetki sorunu yok; kaynağın
 * o anki durumu işlemi imkânsız kılıyor (ör. hesapta zaten aktif bir sayım var).
 * Client bunu "girdiyi düzelt" değil, "mevcut kaydı çöz, sonra tekrar dene"
 * olarak sunmalı.
 *
 * `LockedError` (423) ile farkı: 423 geçici bir kilit (bekle, kalkacak),
 * 409 ise çakışan bir kayıt (mevcut kaydı bitir ya da iptal et).
 */
export declare class ConflictError extends CustomError {
    message: string;
    details?: Record<string, any> | undefined;
    statusCode: number;
    constructor(message: string, details?: Record<string, any> | undefined);
    serializeErrors(): {
        details?: Record<string, any> | undefined;
        message: string;
    }[];
}
