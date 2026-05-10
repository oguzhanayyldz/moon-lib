"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WooCommerceResponseInterpreter = void 0;
const operation_type_enum_1 = require("../../enums/operation-type.enum");
const base_interpreter_1 = require("./base.interpreter");
const logger_service_1 = require("../logger.service");
/**
 * WooCommerce REST API yanıtlarını yorumlayan interpreter
 * WP REST API v3 (/wp-json/wc/v3) format'ı
 */
class WooCommerceResponseInterpreter extends base_interpreter_1.BaseResponseInterpreter {
    interpret(response, operationType) {
        var _a;
        if (this.isEmptyResponse(response)) {
            return null;
        }
        try {
            // WP REST API hata formatı: {code, message, data: {status}}
            if ((response === null || response === void 0 ? void 0 : response.code) && (response === null || response === void 0 ? void 0 : response.message) && ((_a = response === null || response === void 0 ? void 0 : response.data) === null || _a === void 0 ? void 0 : _a.status)) {
                return this.interpretWcError(response);
            }
            switch (operationType) {
                case operation_type_enum_1.OperationType.SEND_PRODUCTS:
                case operation_type_enum_1.OperationType.UPDATE_PRODUCTS:
                    return this.interpretProductOperation(response);
                case operation_type_enum_1.OperationType.FETCH_PRODUCTS:
                    return this.interpretProductList(response);
                case operation_type_enum_1.OperationType.CREATE_ORDER:
                case operation_type_enum_1.OperationType.UPDATE_ORDER:
                    return this.interpretOrderOperation(response);
                case operation_type_enum_1.OperationType.FETCH_ORDERS:
                    return this.interpretOrderList(response);
                case operation_type_enum_1.OperationType.UPDATE_STOCK:
                    return this.interpretStockUpdate(response);
                default:
                    return this.interpretGeneric(response, operationType);
            }
        }
        catch (error) {
            logger_service_1.logger.error('Error interpreting WooCommerce response', {
                operationType,
                error: error.message
            });
            return null;
        }
    }
    interpretWcError(response) {
        return {
            summary: `WooCommerce API hatası (${response.data.status}): ${response.message}`,
            success: false,
            failureCount: 1,
            details: {
                code: response.code,
                status: response.data.status,
                additionalData: response.data
            },
            parsedAt: new Date()
        };
    }
    /**
     * Ürün create/update yanıtı (tek nesne döner)
     */
    interpretProductOperation(response) {
        const productId = response === null || response === void 0 ? void 0 : response.id;
        const name = response === null || response === void 0 ? void 0 : response.name;
        const sku = response === null || response === void 0 ? void 0 : response.sku;
        const type = response === null || response === void 0 ? void 0 : response.type;
        const variationCount = Array.isArray(response === null || response === void 0 ? void 0 : response.variations) ? response.variations.length : 0;
        return {
            summary: `Ürün işlemi başarılı: ${name || sku || productId}${type === 'variable' ? ` (${variationCount} varyant)` : ''}`,
            success: true,
            successCount: 1,
            details: {
                productId,
                name,
                sku,
                type,
                status: response === null || response === void 0 ? void 0 : response.status,
                stockStatus: response === null || response === void 0 ? void 0 : response.stock_status,
                stockQuantity: response === null || response === void 0 ? void 0 : response.stock_quantity,
                variationCount
            },
            parsedAt: new Date()
        };
    }
    /**
     * Ürün list yanıtı (array doğrudan döner — `products` wrapper YOK)
     */
    interpretProductList(response) {
        var _a, _b;
        const products = Array.isArray(response) ? response : [];
        const productCount = products.length;
        return {
            summary: `${productCount} ürün getirildi`,
            success: true,
            successCount: productCount,
            details: {
                productCount,
                firstId: (_a = products[0]) === null || _a === void 0 ? void 0 : _a.id,
                lastId: (_b = products[productCount - 1]) === null || _b === void 0 ? void 0 : _b.id
            },
            parsedAt: new Date()
        };
    }
    /**
     * Sipariş create/update yanıtı (tek nesne döner)
     */
    interpretOrderOperation(response) {
        const orderId = response === null || response === void 0 ? void 0 : response.id;
        const orderNumber = response === null || response === void 0 ? void 0 : response.number;
        const total = response === null || response === void 0 ? void 0 : response.total;
        const currency = response === null || response === void 0 ? void 0 : response.currency;
        return {
            summary: `Sipariş işlemi başarılı: #${orderNumber || orderId} (${total} ${currency})`,
            success: true,
            successCount: 1,
            details: {
                orderId,
                orderNumber,
                total,
                currency,
                status: response === null || response === void 0 ? void 0 : response.status,
                paymentMethod: response === null || response === void 0 ? void 0 : response.payment_method
            },
            parsedAt: new Date()
        };
    }
    /**
     * Sipariş list yanıtı (array doğrudan döner)
     */
    interpretOrderList(response) {
        var _a, _b;
        const orders = Array.isArray(response) ? response : [];
        const orderCount = orders.length;
        return {
            summary: `${orderCount} sipariş getirildi`,
            success: true,
            successCount: orderCount,
            details: {
                orderCount,
                firstId: (_a = orders[0]) === null || _a === void 0 ? void 0 : _a.id,
                lastId: (_b = orders[orderCount - 1]) === null || _b === void 0 ? void 0 : _b.id
            },
            parsedAt: new Date()
        };
    }
    /**
     * Stok güncelleme yanıtı (product update'in alt kümesi: stock_quantity + stock_status)
     */
    interpretStockUpdate(response) {
        const productId = response === null || response === void 0 ? void 0 : response.id;
        const stockQuantity = response === null || response === void 0 ? void 0 : response.stock_quantity;
        const stockStatus = response === null || response === void 0 ? void 0 : response.stock_status;
        const manageStock = response === null || response === void 0 ? void 0 : response.manage_stock;
        return {
            summary: `Stok güncellendi: ${stockQuantity !== null && stockQuantity !== void 0 ? stockQuantity : 'N/A'} adet (${stockStatus || 'unknown'})`,
            success: true,
            successCount: 1,
            details: {
                productId,
                stockQuantity,
                stockStatus,
                manageStock
            },
            parsedAt: new Date()
        };
    }
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
exports.WooCommerceResponseInterpreter = WooCommerceResponseInterpreter;
