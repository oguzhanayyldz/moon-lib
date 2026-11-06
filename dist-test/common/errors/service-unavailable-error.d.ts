import { CustomError } from "./custom-error";
/**
 * 503 Service Unavailable — isteği karşılamak için gereken bağımlılık o an okunamadı (UC-923)
 *
 * NEDEN 400 DEĞİL: İstek geçerli; sorun sunucu tarafında geçici. Fail-closed bir koruma
 * (ör. oturum iptal eşiği okunamadı) isteği durdurduğunda istemci bunu "hatalı giriş" değil
 * "sonra tekrar dene" olarak görmeli. Kök neden (DB hatası) yanıta YAZILMAZ, yalnız loglanır.
 */
export declare class ServiceUnavailableError extends CustomError {
    message: string;
    statusCode: number;
    constructor(message?: string);
    serializeErrors(): {
        message: string;
    }[];
}
//# sourceMappingURL=service-unavailable-error.d.ts.map