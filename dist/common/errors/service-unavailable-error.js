"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceUnavailableError = void 0;
const custom_error_1 = require("./custom-error");
/**
 * 503 Service Unavailable — isteği karşılamak için gereken bağımlılık o an okunamadı (UC-923)
 *
 * NEDEN 400 DEĞİL: İstek geçerli; sorun sunucu tarafında geçici. Fail-closed bir koruma
 * (ör. oturum iptal eşiği okunamadı) isteği durdurduğunda istemci bunu "hatalı giriş" değil
 * "sonra tekrar dene" olarak görmeli. Kök neden (DB hatası) yanıta YAZILMAZ, yalnız loglanır.
 */
class ServiceUnavailableError extends custom_error_1.CustomError {
    constructor(message = 'Service temporarily unavailable') {
        super(message);
        this.message = message;
        this.statusCode = 503;
        Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
    }
    serializeErrors() {
        return [{ message: this.message }];
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
