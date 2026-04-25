"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TSoftResponseInterpreter = void 0;
const operation_type_enum_1 = require("../../enums/operation-type.enum");
const base_interpreter_1 = require("./base.interpreter");
const logger_service_1 = require("../logger.service");
/**
 * T-Soft Admin API (REST) yanıtlarını yorumlayan interpreter.
 *
 * T-Soft REST envelope:
 *   - List endpoint'leri:   `{ data: T[], totalCount, offset, limit }`
 *   - Single endpoint'leri: `{ data: T }`
 *   - Hata:                 `{ error?, errors?, message? }`
 *
 * Source: docs/integrations/tsoft/api-docs.md (Endpoints L450-540, Status Codes L605-650)
 */
class TSoftResponseInterpreter extends base_interpreter_1.BaseResponseInterpreter {
    interpret(response, operationType) {
        if (this.isEmptyResponse(response)) {
            return null;
        }
        try {
            // Hata yanıtı kontrolü (T-Soft 400/401/403/404/422/429 için error/errors/message field)
            if (response.error || response.errors) {
                return this.interpretErrorResponse(response, operationType);
            }
            // Operation-specific interpretation
            switch (operationType) {
                case operation_type_enum_1.OperationType.FETCH_PRODUCTS:
                    return this.interpretProductList(response);
                case operation_type_enum_1.OperationType.SEND_PRODUCTS:
                case operation_type_enum_1.OperationType.UPDATE_PRODUCTS:
                    return this.interpretProductOperation(response, operationType);
                case operation_type_enum_1.OperationType.DELETE_PRODUCTS:
                    return this.interpretDeleteOperation(response, 'ürün');
                case operation_type_enum_1.OperationType.FETCH_ORDERS:
                    return this.interpretOrderList(response);
                case operation_type_enum_1.OperationType.UPDATE_ORDER:
                    return this.interpretOrderOperation(response);
                case operation_type_enum_1.OperationType.CANCEL_ORDER:
                    return this.interpretDeleteOperation(response, 'sipariş');
                case operation_type_enum_1.OperationType.UPDATE_STOCK:
                case operation_type_enum_1.OperationType.SYNC_STOCK:
                    return this.interpretStockUpdate(response);
                case operation_type_enum_1.OperationType.UPDATE_PRICES:
                case operation_type_enum_1.OperationType.FETCH_PRICES:
                    return this.interpretPriceOperation(response, operationType);
                case operation_type_enum_1.OperationType.SEND_TRACKING:
                case operation_type_enum_1.OperationType.DELIVER_ORDER:
                    return this.interpretShipmentUpdate(response);
                case operation_type_enum_1.OperationType.HEALTH_CHECK:
                    return this.interpretHealthCheck(response);
                default:
                    return this.interpretGeneric(response, operationType);
            }
        }
        catch (error) {
            logger_service_1.logger.error('Error interpreting TSoft response', {
                operationType,
                error: error.message
            });
            return null;
        }
    }
    /**
     * Hata yanıtını yorumla.
     * T-Soft hata formatları:
     *   - 422 Validation: `{ errors: { field: [messages] } }` (orderStatus.in, cargoCompanyId.exists, ...)
     *   - 401/403/404:    `{ error: 'message' }` veya `{ message: 'text' }`
     */
    interpretErrorResponse(response, operationType) {
        var _a;
        let errorMessage;
        if (typeof response.error === 'string') {
            errorMessage = response.error;
        }
        else if ((_a = response.error) === null || _a === void 0 ? void 0 : _a.message) {
            errorMessage = response.error.message;
        }
        else if (Array.isArray(response.errors)) {
            errorMessage = response.errors.map((e) => { var _a; return (_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e; }).join(', ');
        }
        else if (response.errors && typeof response.errors === 'object') {
            // Validation error: { field: [messages] }
            const messages = [];
            for (const [field, msgs] of Object.entries(response.errors)) {
                const flat = Array.isArray(msgs) ? msgs.join(', ') : String(msgs);
                messages.push(`${field}: ${flat}`);
            }
            errorMessage = messages.join('; ');
        }
        else if (response.message) {
            errorMessage = response.message;
        }
        else {
            errorMessage = 'Bilinmeyen hata';
        }
        return {
            summary: `${operationType} başarısız: ${errorMessage}`,
            success: false,
            failureCount: 1,
            details: {
                error: response.error,
                errors: response.errors,
                message: response.message
            },
            parsedAt: new Date()
        };
    }
    /**
     * Ürün listesi yanıtını yorumla.
     * T-Soft envelope: `{ data: TSoftProduct[], totalCount, offset, limit }`
     */
    interpretProductList(response) {
        var _a;
        const products = Array.isArray(response === null || response === void 0 ? void 0 : response.data) ? response.data : ((response === null || response === void 0 ? void 0 : response.data) ? [response.data] : []);
        const totalCount = Number((_a = response === null || response === void 0 ? void 0 : response.totalCount) !== null && _a !== void 0 ? _a : products.length);
        return {
            summary: `${products.length} ürün getirildi${totalCount > products.length ? ` (toplam: ${totalCount})` : ''}`,
            success: true,
            successCount: products.length,
            details: {
                productCount: products.length,
                totalCount,
                offset: response === null || response === void 0 ? void 0 : response.offset,
                limit: response === null || response === void 0 ? void 0 : response.limit
            },
            parsedAt: new Date()
        };
    }
    /**
     * Ürün create/update işlemi yanıtını yorumla.
     * T-Soft single envelope: `{ data: TSoftProduct }`
     */
    interpretProductOperation(response, operationType) {
        var _a;
        const product = (_a = response === null || response === void 0 ? void 0 : response.data) !== null && _a !== void 0 ? _a : response;
        const productId = product === null || product === void 0 ? void 0 : product.id;
        const productName = product === null || product === void 0 ? void 0 : product.name; // T-Soft docs L1153: product field 'name' only
        return {
            summary: `Ürün ${operationType === operation_type_enum_1.OperationType.SEND_PRODUCTS ? 'oluşturuldu' : 'güncellendi'}: ${productName || productId}`,
            success: true,
            successCount: 1,
            details: {
                productId,
                productName,
                wsProductCode: product === null || product === void 0 ? void 0 : product.wsProductCode, // Supplier (docs L1188)
                barcode: product === null || product === void 0 ? void 0 : product.barcode, // Basic Information (docs L1155)
                priceSale: product === null || product === void 0 ? void 0 : product.priceSale, // Price and Stock (docs L1167)
                priceDiscount: product === null || product === void 0 ? void 0 : product.priceDiscount, // Price and Stock (docs L1168)
                stock: product === null || product === void 0 ? void 0 : product.stock, // Price and Stock (docs L1170)
                stock2: product === null || product === void 0 ? void 0 : product.stock2, // Multi-warehouse (docs L1171)
                stock99: product === null || product === void 0 ? void 0 : product.stock99, // Backup stock (docs L1172)
                vat: product === null || product === void 0 ? void 0 : product.vat, // Price and Stock (docs L1169)
                brandId: product === null || product === void 0 ? void 0 : product.brandId, // Brand and Model (docs L1202)
                visibility: product === null || product === void 0 ? void 0 : product.visibility // Basic Information (docs L1156)
            },
            parsedAt: new Date()
        };
    }
    /**
     * Sipariş listesi yanıtını yorumla.
     * T-Soft envelope: `{ data: TSoftOrder[], totalCount, offset, limit }`
     */
    interpretOrderList(response) {
        var _a;
        const orders = Array.isArray(response === null || response === void 0 ? void 0 : response.data) ? response.data : ((response === null || response === void 0 ? void 0 : response.data) ? [response.data] : []);
        const totalCount = Number((_a = response === null || response === void 0 ? void 0 : response.totalCount) !== null && _a !== void 0 ? _a : orders.length);
        return {
            summary: `${orders.length} sipariş getirildi${totalCount > orders.length ? ` (toplam: ${totalCount})` : ''}`,
            success: true,
            successCount: orders.length,
            details: {
                orderCount: orders.length,
                totalCount,
                offset: response === null || response === void 0 ? void 0 : response.offset,
                limit: response === null || response === void 0 ? void 0 : response.limit
            },
            parsedAt: new Date()
        };
    }
    /**
     * Sipariş update yanıtını yorumla.
     * T-Soft PUT /orders/order/{id} envelope: `{ data: TSoftOrder }`
     * Order field'lari FLAT (docs L754-840: orderNumber, orderStatus, cargo*, customer*, payment*).
     */
    interpretOrderOperation(response) {
        var _a;
        const order = (_a = response === null || response === void 0 ? void 0 : response.data) !== null && _a !== void 0 ? _a : response;
        const orderId = order === null || order === void 0 ? void 0 : order.id;
        const orderNumber = order === null || order === void 0 ? void 0 : order.orderNumber;
        return {
            summary: `Sipariş güncellendi: ${orderNumber || orderId}`,
            success: true,
            successCount: 1,
            details: {
                orderId,
                orderNumber,
                orderStatus: order === null || order === void 0 ? void 0 : order.orderStatus, // docs L755
                cargoCompanyId: order === null || order === void 0 ? void 0 : order.cargoCompanyId, // docs L811
                cargoCompanyName: order === null || order === void 0 ? void 0 : order.cargoCompanyName, // docs L812
                cargoNumber: order === null || order === void 0 ? void 0 : order.cargoNumber, // docs L813
                waybillNumber: order === null || order === void 0 ? void 0 : order.waybillNumber, // docs L817
                shipmentDate: order === null || order === void 0 ? void 0 : order.shipmentDate, // docs L819
                deliveryDate: order === null || order === void 0 ? void 0 : order.deliveryDate, // docs L818
                // Customer FLAT (docs L789-796)
                customerId: order === null || order === void 0 ? void 0 : order.customerId,
                customerEmail: order === null || order === void 0 ? void 0 : order.customerEmail,
                customerFirstName: order === null || order === void 0 ? void 0 : order.customerFirstName,
                customerLastName: order === null || order === void 0 ? void 0 : order.customerLastName,
                // Invoice (docs L823-830)
                isInvoiced: order === null || order === void 0 ? void 0 : order.isInvoiced,
                invoiceNumber: order === null || order === void 0 ? void 0 : order.invoiceNumber
            },
            parsedAt: new Date()
        };
    }
    /**
     * Stok güncelleme yanıtını yorumla.
     * T-Soft: PUT /catalog/products/{id} `{ stock | stock2 | stock99 }` -> `{ data: TSoftProduct }`
     */
    interpretStockUpdate(response) {
        var _a;
        const product = (_a = response === null || response === void 0 ? void 0 : response.data) !== null && _a !== void 0 ? _a : response;
        const productId = product === null || product === void 0 ? void 0 : product.id;
        const stock = product === null || product === void 0 ? void 0 : product.stock;
        const stock2 = product === null || product === void 0 ? void 0 : product.stock2;
        const stock99 = product === null || product === void 0 ? void 0 : product.stock99;
        return {
            summary: stock !== undefined
                ? `Stok güncellendi: ${stock} adet (ürün: ${productId})`
                : 'Stok güncelleme başarılı',
            success: true,
            successCount: 1,
            details: {
                productId,
                stock,
                stock2,
                stock99
            },
            parsedAt: new Date()
        };
    }
    /**
     * Fiyat işlemi yanıtını yorumla.
     * T-Soft prices product seviyesinde tutulur: `priceSale`, `priceDiscount`.
     */
    interpretPriceOperation(response, operationType) {
        var _a;
        const items = Array.isArray(response === null || response === void 0 ? void 0 : response.data) ? response.data : null;
        if (items) {
            return {
                summary: `${items.length} fiyat bilgisi getirildi`,
                success: true,
                successCount: items.length,
                details: { count: items.length, totalCount: response === null || response === void 0 ? void 0 : response.totalCount },
                parsedAt: new Date()
            };
        }
        const product = (_a = response === null || response === void 0 ? void 0 : response.data) !== null && _a !== void 0 ? _a : response;
        const productId = product === null || product === void 0 ? void 0 : product.id;
        return {
            summary: `Fiyat ${operationType === operation_type_enum_1.OperationType.FETCH_PRICES ? 'getirildi' : 'güncellendi'}: ürün ${productId}`,
            success: true,
            successCount: 1,
            details: {
                productId,
                priceSale: product === null || product === void 0 ? void 0 : product.priceSale,
                priceDiscount: product === null || product === void 0 ? void 0 : product.priceDiscount,
                purchasePrice: product === null || product === void 0 ? void 0 : product.purchasePrice
            },
            parsedAt: new Date()
        };
    }
    /**
     * Kargo bildirimi yanıtını yorumla.
     * T-Soft: PUT /orders/order/{id} `{ cargoCompanyId, waybillNumber, cargoNumber }` -> `{ data: TSoftOrder }`
     */
    interpretShipmentUpdate(response) {
        var _a;
        const order = (_a = response === null || response === void 0 ? void 0 : response.data) !== null && _a !== void 0 ? _a : response;
        const orderId = order === null || order === void 0 ? void 0 : order.id;
        const trackingCode = (order === null || order === void 0 ? void 0 : order.waybillNumber) || (order === null || order === void 0 ? void 0 : order.cargoNumber);
        return {
            summary: `Kargo bildirimi başarılı${trackingCode ? `: ${trackingCode}` : ''}`,
            success: true,
            successCount: 1,
            details: {
                orderId,
                waybillNumber: order === null || order === void 0 ? void 0 : order.waybillNumber,
                cargoNumber: order === null || order === void 0 ? void 0 : order.cargoNumber,
                cargoCompanyId: order === null || order === void 0 ? void 0 : order.cargoCompanyId,
                cargoCompanyName: order === null || order === void 0 ? void 0 : order.cargoCompanyName,
                shipmentDate: order === null || order === void 0 ? void 0 : order.shipmentDate
            },
            parsedAt: new Date()
        };
    }
    /**
     * Silme/iptal işlemi yanıtını yorumla.
     * T-Soft DELETE /orders/order/{id} -> archive (soft delete), DELETE /catalog/products/{id} -> hard delete.
     */
    interpretDeleteOperation(response, entityName) {
        var _a;
        const entity = (_a = response === null || response === void 0 ? void 0 : response.data) !== null && _a !== void 0 ? _a : response;
        const id = entity === null || entity === void 0 ? void 0 : entity.id;
        return {
            summary: `${entityName} silindi${id ? `: #${id}` : ''}`,
            success: true,
            successCount: 1,
            details: { id },
            parsedAt: new Date()
        };
    }
    /**
     * Health check yanıtını yorumla.
     * T-Soft'ta dedicated /health endpoint yok — TSoftApiClient `GET /catalog/products?limit=1` ile probe yapıyor.
     */
    interpretHealthCheck(response) {
        return {
            summary: 'T-Soft sağlık kontrolü başarılı',
            success: true,
            details: {
                hasData: !this.isEmptyResponse(response)
            },
            parsedAt: new Date()
        };
    }
    /**
     * Genel yanıt yorumlama.
     */
    interpretGeneric(response, operationType) {
        const items = Array.isArray(response === null || response === void 0 ? void 0 : response.data) ? response.data : null;
        if (items) {
            return {
                summary: `${operationType} işlemi tamamlandı (${items.length} kayıt)`,
                success: true,
                successCount: items.length,
                details: {
                    count: items.length,
                    totalCount: response === null || response === void 0 ? void 0 : response.totalCount
                },
                parsedAt: new Date()
            };
        }
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
exports.TSoftResponseInterpreter = TSoftResponseInterpreter;
