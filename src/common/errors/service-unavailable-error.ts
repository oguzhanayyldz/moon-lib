import { CustomError } from "./custom-error";

/**
 * 503 Service Unavailable — isteği karşılamak için gereken bağımlılık o an okunamadı (UC-923)
 *
 * NEDEN 400 DEĞİL: İstek geçerli; sorun sunucu tarafında geçici. Fail-closed bir koruma
 * (ör. oturum iptal eşiği okunamadı) isteği durdurduğunda istemci bunu "hatalı giriş" değil
 * "sonra tekrar dene" olarak görmeli. Kök neden (DB hatası) yanıta YAZILMAZ, yalnız loglanır.
 */
export class ServiceUnavailableError extends CustomError {
    statusCode = 503;

    constructor(public message: string = 'Service temporarily unavailable') {
        super(message);

        Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
    }

    serializeErrors() {
        return [{ message: this.message }];
    }
}
