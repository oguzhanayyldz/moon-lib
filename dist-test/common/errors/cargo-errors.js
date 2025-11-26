"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CargoCancelledError = exports.CargoServiceUnavailableError = exports.CargoShipmentNotFoundError = exports.CargoRateLimitError = exports.CargoAuthenticationError = exports.CargoValidationError = exports.CargoApiError = void 0;
const custom_error_1 = require("./custom-error");
/**
 * Cargo API Error
 * Kargo entegrasyon API'sinden dönen hatalarda kullanılır
 */
class CargoApiError extends custom_error_1.CustomError {
    constructor(message, cargoProvider, errorCode, errorDetails) {
        super(message);
        this.message = message;
        this.cargoProvider = cargoProvider;
        this.errorCode = errorCode;
        this.errorDetails = errorDetails;
        this.statusCode = 400;
        Object.setPrototypeOf(this, CargoApiError.prototype);
    }
    serializeErrors() {
        return [
            {
                message: this.message,
                field: 'cargoApi',
                cargoProvider: this.cargoProvider,
                errorCode: this.errorCode,
                errorDetails: this.errorDetails
            }
        ];
    }
}
exports.CargoApiError = CargoApiError;
/**
 * Cargo Validation Error
 * Kargo verilerinin validasyonu başarısız olduğunda kullanılır
 */
class CargoValidationError extends custom_error_1.CustomError {
    constructor(errors) {
        super('Cargo validation failed');
        this.errors = errors;
        this.statusCode = 400;
        Object.setPrototypeOf(this, CargoValidationError.prototype);
    }
    serializeErrors() {
        return this.errors.map(err => ({
            message: err.message,
            field: err.field
        }));
    }
}
exports.CargoValidationError = CargoValidationError;
/**
 * Cargo Authentication Error
 * Kargo entegrasyonu authentication hatası
 */
class CargoAuthenticationError extends custom_error_1.CustomError {
    constructor(message = 'Cargo authentication failed', cargoProvider) {
        super(message);
        this.message = message;
        this.cargoProvider = cargoProvider;
        this.statusCode = 401;
        Object.setPrototypeOf(this, CargoAuthenticationError.prototype);
    }
    serializeErrors() {
        return [
            {
                message: this.message,
                field: 'cargoAuth',
                cargoProvider: this.cargoProvider
            }
        ];
    }
}
exports.CargoAuthenticationError = CargoAuthenticationError;
/**
 * Cargo Rate Limit Error
 * Kargo entegrasyonu rate limit aşımı
 */
class CargoRateLimitError extends custom_error_1.CustomError {
    constructor(message = 'Cargo API rate limit exceeded', cargoProvider, retryAfter) {
        super(message);
        this.message = message;
        this.cargoProvider = cargoProvider;
        this.retryAfter = retryAfter;
        this.statusCode = 429;
        Object.setPrototypeOf(this, CargoRateLimitError.prototype);
    }
    serializeErrors() {
        return [
            {
                message: this.message,
                field: 'cargoRateLimit',
                cargoProvider: this.cargoProvider,
                retryAfter: this.retryAfter
            }
        ];
    }
}
exports.CargoRateLimitError = CargoRateLimitError;
/**
 * Cargo Shipment Not Found Error
 * Kargo kaydı bulunamadı hatası
 */
class CargoShipmentNotFoundError extends custom_error_1.CustomError {
    constructor(shippingNumber, cargoProvider) {
        super(`Shipment not found: ${shippingNumber}`);
        this.shippingNumber = shippingNumber;
        this.cargoProvider = cargoProvider;
        this.statusCode = 404;
        Object.setPrototypeOf(this, CargoShipmentNotFoundError.prototype);
    }
    serializeErrors() {
        return [
            {
                message: this.message,
                field: 'shipment',
                shippingNumber: this.shippingNumber,
                cargoProvider: this.cargoProvider
            }
        ];
    }
}
exports.CargoShipmentNotFoundError = CargoShipmentNotFoundError;
/**
 * Cargo Service Unavailable Error
 * Kargo servisi ulaşılamıyor hatası (circuit breaker, timeout, etc.)
 */
class CargoServiceUnavailableError extends custom_error_1.CustomError {
    constructor(message = 'Cargo service temporarily unavailable', cargoProvider) {
        super(message);
        this.message = message;
        this.cargoProvider = cargoProvider;
        this.statusCode = 503;
        Object.setPrototypeOf(this, CargoServiceUnavailableError.prototype);
    }
    serializeErrors() {
        return [
            {
                message: this.message,
                field: 'cargoService',
                cargoProvider: this.cargoProvider
            }
        ];
    }
}
exports.CargoServiceUnavailableError = CargoServiceUnavailableError;
/**
 * Cargo Cancelled Error
 * Kargo iptal işlemi başarısız oldu hatası
 */
class CargoCancelledError extends custom_error_1.CustomError {
    constructor(message, shippingNumber, reason) {
        super(message);
        this.message = message;
        this.shippingNumber = shippingNumber;
        this.reason = reason;
        this.statusCode = 400;
        Object.setPrototypeOf(this, CargoCancelledError.prototype);
    }
    serializeErrors() {
        return [
            {
                message: this.message,
                field: 'cargoCancellation',
                shippingNumber: this.shippingNumber,
                reason: this.reason
            }
        ];
    }
}
exports.CargoCancelledError = CargoCancelledError;
//# sourceMappingURL=cargo-errors.js.map