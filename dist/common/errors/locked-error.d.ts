import { CustomError } from "./custom-error";
/**
 * 423 Locked — kaynak geçici olarak kilitli (issue #637)
 *
 * NEDEN 400 DEĞİL: İstek biçimsel olarak geçerli; sorun kaynağın o an
 * kilitli olması. Client bunu "hatalı giriş" gibi değil, "şu an mümkün değil,
 * sonra tekrar dene" olarak göstermeli. Kilit sebebi ve varsa kalan süre
 * `details` içinde taşınır.
 */
export declare class LockedError extends CustomError {
    message: string;
    details?: Record<string, any> | undefined;
    statusCode: number;
    constructor(message: string, details?: Record<string, any> | undefined);
    serializeErrors(): {
        details?: Record<string, any> | undefined;
        message: string;
    }[];
}
