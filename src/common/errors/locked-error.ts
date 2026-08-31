import { CustomError } from "./custom-error";

/**
 * 423 Locked — kaynak geçici olarak kilitli (issue #637)
 *
 * NEDEN 400 DEĞİL: İstek biçimsel olarak geçerli; sorun kaynağın o an
 * kilitli olması. Client bunu "hatalı giriş" gibi değil, "şu an mümkün değil,
 * sonra tekrar dene" olarak göstermeli. Kilit sebebi ve varsa kalan süre
 * `details` içinde taşınır.
 */
export class LockedError extends CustomError {
    statusCode = 423;

    constructor(public message: string, public details?: Record<string, any>) {
        super(message);

        Object.setPrototypeOf(this, LockedError.prototype);
    }

    serializeErrors() {
        return [{ message: this.message, ...(this.details ? { details: this.details } : {}) }];
    }
}
