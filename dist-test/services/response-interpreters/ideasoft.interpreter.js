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
                case operation_type_enum_1.OperationType.UPDATE_PRICES:
                case operation_type_enum_1.OperationType.FETCH_PRICES:
                    return this.interpretPriceOperation(response, operationType);
                case operation_type_enum_1.OperationType.GET_BRANDS:
                    return this.interpretBrandList(response);
                case operation_type_enum_1.OperationType.GET_CATEGORIES:
                    return this.interpretCategoryList(response);
                case operation_type_enum_1.OperationType.SEND_TRACKING:
                case operation_type_enum_1.OperationType.DELIVER_ORDER:
                    return this.interpretShipmentUpdate(response);
                case operation_type_enum_1.OperationType.FETCH_CLAIMS:
                case operation_type_enum_1.OperationType.ACCEPT_CLAIM:
                case operation_type_enum_1.OperationType.REJECT_CLAIM:
                    return this.interpretRefundOperation(response, operationType);
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
     * Fiyat işlemi yanıtını yorumla (GET /product_prices, PUT /product_prices/{id})
     */
    interpretPriceOperation(response, operationType) {
        var _a;
        if (Array.isArray(response)) {
            return {
                summary: `${response.length} fiyat bilgisi getirildi`,
                success: true,
                successCount: response.length,
                details: { count: response.length },
                parsedAt: new Date()
            };
        }
        const productId = ((_a = response === null || response === void 0 ? void 0 : response.product) === null || _a === void 0 ? void 0 : _a.id) || (response === null || response === void 0 ? void 0 : response.id);
        return {
            summary: `Fiyat ${operationType === operation_type_enum_1.OperationType.FETCH_PRICES ? 'getirildi' : 'güncellendi'}: ürün ${productId}`,
            success: true,
            successCount: 1,
            details: {
                productId,
                price1: response === null || response === void 0 ? void 0 : response.price1,
                discount: response === null || response === void 0 ? void 0 : response.discount
            },
            parsedAt: new Date()
        };
    }
    /**
     * Marka listesi yanıtını yorumla (GET /brands)
     */
    interpretBrandList(response) {
        const brands = Array.isArray(response) ? response : [response];
        return {
            summary: `${brands.length} marka getirildi`,
            success: true,
            successCount: brands.length,
            details: {
                brandCount: brands.length,
                brands: brands.slice(0, 5).map((b) => ({ id: b.id, name: b.name }))
            },
            parsedAt: new Date()
        };
    }
    /**
     * Kategori listesi yanıtını yorumla (GET /categories)
     */
    interpretCategoryList(response) {
        const categories = Array.isArray(response) ? response : [response];
        return {
            summary: `${categories.length} kategori getirildi`,
            success: true,
            successCount: categories.length,
            details: {
                categoryCount: categories.length,
                categories: categories.slice(0, 5).map((c) => ({ id: c.id, name: c.name }))
            },
            parsedAt: new Date()
        };
    }
    /**
     * Kargo/shipment güncelleme yanıtını yorumla
     * IdeaSoft: Shipment CreateAction PUT, shippingTrackingCode field
     */
    interpretShipmentUpdate(response) {
        const shipmentId = response === null || response === void 0 ? void 0 : response.id;
        const trackingCode = (response === null || response === void 0 ? void 0 : response.shippingTrackingCode) || (response === null || response === void 0 ? void 0 : response.barcode);
        return {
            summary: `Kargo bildirimi başarılı${trackingCode ? `: ${trackingCode}` : ''}`,
            success: true,
            successCount: 1,
            details: {
                shipmentId,
                trackingCode,
                shippingCompanyName: response === null || response === void 0 ? void 0 : response.shippingCompanyName,
                status: response === null || response === void 0 ? void 0 : response.status
            },
            parsedAt: new Date()
        };
    }
    /**
     * İade işlemi yanıtını yorumla (GET/POST /order_refund_requests)
     */
    interpretRefundOperation(response, operationType) {
        if (Array.isArray(response)) {
            return {
                summary: `${response.length} iade talebi getirildi`,
                success: true,
                successCount: response.length,
                details: {
                    refundCount: response.length,
                    statuses: response.slice(0, 10).map((r) => ({ id: r.id, status: r.status }))
                },
                parsedAt: new Date()
            };
        }
        const refundId = response === null || response === void 0 ? void 0 : response.id;
        const status = response === null || response === void 0 ? void 0 : response.status;
        const actionLabel = operationType === operation_type_enum_1.OperationType.ACCEPT_CLAIM ? 'onaylandı'
            : operationType === operation_type_enum_1.OperationType.REJECT_CLAIM ? 'reddedildi'
                : 'işlendi';
        return {
            summary: `İade talebi ${actionLabel}: #${refundId}${status ? ` (${status})` : ''}`,
            success: true,
            successCount: 1,
            details: {
                refundId,
                status,
                fee: response === null || response === void 0 ? void 0 : response.fee,
                shippingFee: response === null || response === void 0 ? void 0 : response.shippingFee
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