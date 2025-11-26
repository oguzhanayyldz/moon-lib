import { CustomError } from './custom-error';
/**
 * Cargo API Error
 * Kargo entegrasyon API'sinden dönen hatalarda kullanılır
 */
export declare class CargoApiError extends CustomError {
    message: string;
    cargoProvider?: string | undefined;
    errorCode?: string | undefined;
    errorDetails?: any | undefined;
    statusCode: number;
    constructor(message: string, cargoProvider?: string | undefined, errorCode?: string | undefined, errorDetails?: any | undefined);
    serializeErrors(): {
        message: string;
        field: string;
        cargoProvider: string | undefined;
        errorCode: string | undefined;
        errorDetails: any;
    }[];
}
/**
 * Cargo Validation Error
 * Kargo verilerinin validasyonu başarısız olduğunda kullanılır
 */
export declare class CargoValidationError extends CustomError {
    errors: Array<{
        field: string;
        message: string;
    }>;
    statusCode: number;
    constructor(errors: Array<{
        field: string;
        message: string;
    }>);
    serializeErrors(): {
        message: string;
        field: string;
    }[];
}
/**
 * Cargo Authentication Error
 * Kargo entegrasyonu authentication hatası
 */
export declare class CargoAuthenticationError extends CustomError {
    message: string;
    cargoProvider?: string | undefined;
    statusCode: number;
    constructor(message?: string, cargoProvider?: string | undefined);
    serializeErrors(): {
        message: string;
        field: string;
        cargoProvider: string | undefined;
    }[];
}
/**
 * Cargo Rate Limit Error
 * Kargo entegrasyonu rate limit aşımı
 */
export declare class CargoRateLimitError extends CustomError {
    message: string;
    cargoProvider?: string | undefined;
    retryAfter?: number | undefined;
    statusCode: number;
    constructor(message?: string, cargoProvider?: string | undefined, retryAfter?: number | undefined);
    serializeErrors(): {
        message: string;
        field: string;
        cargoProvider: string | undefined;
        retryAfter: number | undefined;
    }[];
}
/**
 * Cargo Shipment Not Found Error
 * Kargo kaydı bulunamadı hatası
 */
export declare class CargoShipmentNotFoundError extends CustomError {
    shippingNumber: string;
    cargoProvider?: string | undefined;
    statusCode: number;
    constructor(shippingNumber: string, cargoProvider?: string | undefined);
    serializeErrors(): {
        message: string;
        field: string;
        shippingNumber: string;
        cargoProvider: string | undefined;
    }[];
}
/**
 * Cargo Service Unavailable Error
 * Kargo servisi ulaşılamıyor hatası (circuit breaker, timeout, etc.)
 */
export declare class CargoServiceUnavailableError extends CustomError {
    message: string;
    cargoProvider?: string | undefined;
    statusCode: number;
    constructor(message?: string, cargoProvider?: string | undefined);
    serializeErrors(): {
        message: string;
        field: string;
        cargoProvider: string | undefined;
    }[];
}
/**
 * Cargo Cancelled Error
 * Kargo iptal işlemi başarısız oldu hatası
 */
export declare class CargoCancelledError extends CustomError {
    message: string;
    shippingNumber: string;
    reason?: string | undefined;
    statusCode: number;
    constructor(message: string, shippingNumber: string, reason?: string | undefined);
    serializeErrors(): {
        message: string;
        field: string;
        shippingNumber: string;
        reason: string | undefined;
    }[];
}
