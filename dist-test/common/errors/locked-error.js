"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LockedError = void 0;
const custom_error_1 = require("./custom-error");
/**
 * 423 Locked — kaynak geçici olarak kilitli (issue #637)
 *
 * NEDEN 400 DEĞİL: İstek biçimsel olarak geçerli; sorun kaynağın o an
 * kilitli olması. Client bunu "hatalı giriş" gibi değil, "şu an mümkün değil,
 * sonra tekrar dene" olarak göstermeli. Kilit sebebi ve varsa kalan süre
 * `details` içinde taşınır.
 */
class LockedError extends custom_error_1.CustomError {
    constructor(message, details) {
        super(message);
        this.message = message;
        this.details = details;
        this.statusCode = 423;
        Object.setPrototypeOf(this, LockedError.prototype);
    }
    serializeErrors() {
        return [Object.assign({ message: this.message }, (this.details ? { details: this.details } : {}))];
    }
}
exports.LockedError = LockedError;
//# sourceMappingURL=locked-error.js.map