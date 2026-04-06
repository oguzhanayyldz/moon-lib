"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdeaSoftResponseInterpreter = void 0;
const operation_type_enum_1 = require("../../enums/operation-type.enum");
const base_interpreter_1 = require("./base.interpreter");
const logger_service_1 = require("../logger.service");
/**
 * IdeaSoft Admin API (REST) yanıtlarını yorumlayan interpreter
 * IdeaSoft tüm işlemlerini REST endpoint'leri üzerinden yapar
 */
class IdeaSoftResponseInterpreter extends base_interpreter_1.BaseResponseInterpreter {
    interpret(response, operationType) {
        if (this.isEmptyResponse(response)) {
            return null;
        }
        try {
            // Hata yanıtı kontrolü
            if (response.error || response.errors) {
                return this.interpretErrorResponse(response, operationType);
            }
            // Array response (liste endpoint'leri)
            if (Array.isArray(response)) {
                return this.interpretListResponse(response, operationType);
            }
            // Operation-specific interpretation
            switch (operationType) {
                case operation_type_enum_1.OperationType.FETCH_PRODUCTS:
                    return this.interpretProductList(response);
                case operation_type_enum_1.OperationType.SEND_PRODUCTS:
                case operation_type_enum_1.OperationType.UPDATE_PRODUCTS:
                    return this.interpretProductOperation(response, operationType);
                case operation_type_enum_1.OperationType.FETCH_ORDERS:
                    return this.interpretOrderList(response);
                case operation_type_enum_1.OperationType.CREATE_ORDER:
                case operation_type_enum_1.OperationType.UPDATE_ORDER:
                    return this.interpretOrderOperation(response, operationType);
                case operation_type_enum_1.OperationType.UPDATE_STOCK:
                case operation_type_enum_1.OperationType.SYNC_STOCK:
                    return this.interpretStockUpdate(response);
                case operation_type_enum_1.OperationType.SEND_TRACKING:
                    return this.interpretShipmentUpdate(response);
                default:
                    return this.interpretGeneric(response, operationType);
            }
        }
        catch (error) {
            logger_service_1.logger.error('Error interpreting IdeaSoft response', {
                operationType,
                error: error.message
            });
            return null;
        }
    }
    /**
     * Hata yanıtını yorumla
     */
    interpretErrorResponse(response, operationType) {
        var _a;
        const errorMessage = ((_a = response.error) === null || _a === void 0 ? void 0 : _a.message)
            || (Array.isArray(response.errors) ? response.errors.map((e) => e.message).join(', ') : response.errors)
            || 'Bilinmeyen hata';
        return {
            summary: `${operationType} başarısız: ${errorMessage}`,
            success: false,
            failureCount: 1,
            details: {
                error: response.error,
                errors: response.errors
            },
            parsedAt: new Date()
        };
    }
    /**
     * Liste yanıtını yorumla (array response)
     */
    interpretListResponse(response, operationType) {
        const entityName = operationType === operation_type_enum_1.OperationType.FETCH_PRODUCTS ? 'ürün'
            : operationType === operation_type_enum_1.OperationType.FETCH_ORDERS ? 'sipariş'
                : 'kayıt';
        return {
            summary: `${response.length} ${entityName} getirildi`,
            success: true,
            successCount: response.length,
            details: {
                count: response.length
            },
            parsedAt: new Date()
        };
    }
    /**
     * Ürün listesi yanıtını yorumla
     */
    interpretProductList(response) {
        const products = Array.isArray(response) ? response : (response.data || [response]);
        const productCount = products.length;
        return {
            summary: `${productCount} ürün getirildi`,
            success: true,
            successCount: productCount,
            details: {
                productCount
            },
            parsedAt: new Date()
        };
    }
    /**
     * Ürün create/update işlemi yanıtını yorumla
     */
    interpretProductOperation(response, operationType) {
        const productId = response === null || response === void 0 ? void 0 : response.id;
        const productName = response === null || response === void 0 ? void 0 : response.name;
        return {
            summary: `Ürün ${operationType === operation_type_enum_1.OperationType.SEND_PRODUCTS ? 'oluşturuldu' : 'güncellendi'}: ${productName || productId}`,
            success: true,
            successCount: 1,
            details: {
                productId,
                productName,
                sku: response === null || response === void 0 ? void 0 : response.sku,
                stockCount: response === null || response === void 0 ? void 0 : response.stockCount
            },
            parsedAt: new Date()
        };
    }
    /**
     * Sipariş listesi yanıtını yorumla
     */
    interpretOrderList(response) {
        const orders = Array.isArray(response) ? response : (response.data || [response]);
        const orderCount = orders.length;
        return {
            summary: `${orderCount} sipariş getirildi`,
            success: true,
            successCount: orderCount,
            details: {
                orderCount
            },
            parsedAt: new Date()
        };
    }
    /**
     * Sipariş create/update işlemi yanıtını yorumla
     */
    interpretOrderOperation(response, operationType) {
        const orderId = response === null || response === void 0 ? void 0 : response.id;
        const orderNumber = response === null || response === void 0 ? void 0 : response.orderNumber;
        return {
            summary: `Sipariş ${operationType === operation_type_enum_1.OperationType.CREATE_ORDER ? 'oluşturuldu' : 'güncellendi'}: ${orderNumber || orderId}`,
            success: true,
            successCount: 1,
            details: {
                orderId,
                orderNumber,
                status: response === null || response === void 0 ? void 0 : response.status
            },
            parsedAt: new Date()
        };
    }
    /**
     * Stok güncelleme yanıtını yorumla
     */
    interpretStockUpdate(response) {
        const productId = response === null || response === void 0 ? void 0 : response.id;
        const stockCount = response === null || response === void 0 ? void 0 : response.stockCount;
        return {
            summary: stockCount !== undefined
                ? `Stok güncellendi: ${stockCount} adet (ürün: ${productId})`
                : 'Stok güncelleme başarılı',
            success: true,
            successCount: 1,
            details: {
                productId,
                stockCount
            },
            parsedAt: new Date()
        };
    }
    /**
     * Kargo/shipment güncelleme yanıtını yorumla
     */
    interpretShipmentUpdate(response) {
        const shipmentId = response === null || response === void 0 ? void 0 : response.id;
        const trackingNumber = response === null || response === void 0 ? void 0 : response.trackingNumber;
        return {
            summary: `Kargo bildirimi başarılı${trackingNumber ? `: ${trackingNumber}` : ''}`,
            success: true,
            successCount: 1,
            details: {
                shipmentId,
                trackingNumber,
                status: response === null || response === void 0 ? void 0 : response.status
            },
            parsedAt: new Date()
        };
    }
    /**
     * Genel yanıt yorumlama
     */
    interpretGeneric(response, operationType) {
        return {
            summary: `${operationType} işlemi tamamlandı`,
            success: true,
            details: {
                responseType: typeof response,
                hasData: !this.isEmptyResponse(response)
            },
            parsedAt: new Date()
        };
    }
}
exports.IdeaSoftResponseInterpreter = IdeaSoftResponseInterpreter;
//# sourceMappingURL=ideasoft.interpreter.js.map