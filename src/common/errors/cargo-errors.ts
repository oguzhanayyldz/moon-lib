import { CustomError } from './custom-error';

/**
 * Cargo API Error
 * Kargo entegrasyon API'sinden dönen hatalarda kullanılır
 */
export class CargoApiError extends CustomError {
    statusCode = 400;

    constructor(
        public message: string,
        public cargoProvider?: string,
        public errorCode?: string,
        public errorDetails?: any
    ) {
        super(message);
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

/**
 * Cargo Validation Error
 * Kargo verilerinin validasyonu başarısız olduğunda kullanılır
 */
export class CargoValidationError extends CustomError {
    statusCode = 400;

    constructor(public errors: Array<{ field: string; message: string }>) {
        super('Cargo validation failed');
        Object.setPrototypeOf(this, CargoValidationError.prototype);
    }

    serializeErrors() {
        return this.errors.map(err => ({
            message: err.message,
            field: err.field
        }));
    }
}

/**
 * Cargo Authentication Error
 * Kargo entegrasyonu authentication hatası
 */
export class CargoAuthenticationError extends CustomError {
    statusCode = 401;

    constructor(
        public message: string = 'Cargo authentication failed',
        public cargoProvider?: string
    ) {
        super(message);
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

/**
 * Cargo Rate Limit Error
 * Kargo entegrasyonu rate limit aşımı
 */
export class CargoRateLimitError extends CustomError {
    statusCode = 429;

    constructor(
        public message: string = 'Cargo API rate limit exceeded',
        public cargoProvider?: string,
        public retryAfter?: number
    ) {
        super(message);
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

/**
 * Cargo Shipment Not Found Error
 * Kargo kaydı bulunamadı hatası
 */
export class CargoShipmentNotFoundError extends CustomError {
    statusCode = 404;

    constructor(
        public shippingNumber: string,
        public cargoProvider?: string
    ) {
        super(`Shipment not found: ${shippingNumber}`);
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

/**
 * Cargo Service Unavailable Error
 * Kargo servisi ulaşılamıyor hatası (circuit breaker, timeout, etc.)
 */
export class CargoServiceUnavailableError extends CustomError {
    statusCode = 503;

    constructor(
        public message: string = 'Cargo service temporarily unavailable',
        public cargoProvider?: string
    ) {
        super(message);
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

/**
 * Cargo Cancelled Error
 * Kargo iptal işlemi başarısız oldu hatası
 */
export class CargoCancelledError extends CustomError {
    statusCode = 400;

    constructor(
        public message: string,
        public shippingNumber: string,
        public reason?: string
    ) {
        super(message);
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
