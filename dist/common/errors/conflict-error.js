"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConflictError = void 0;
const custom_error_1 = require("./custom-error");
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
class ConflictError extends custom_error_1.CustomError {
    constructor(message, details) {
        super(message);
        this.message = message;
        this.details = details;
        this.statusCode = 409;
        Object.setPrototypeOf(this, ConflictError.prototype);
    }
    serializeErrors() {
        return [Object.assign({ message: this.message }, (this.details ? { details: this.details } : {}))];
    }
}
exports.ConflictError = ConflictError;
