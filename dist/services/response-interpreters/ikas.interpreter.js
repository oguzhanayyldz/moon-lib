"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IkasResponseInterpreter = void 0;
const operation_type_enum_1 = require("../../enums/operation-type.enum");
const base_interpreter_1 = require("./base.interpreter");
const logger_service_1 = require("../logger.service");
/**
 * ikas GraphQL API yanıtlarını yorumlayan interpreter
 * ikas tüm işlemlerini GraphQL üzerinden yapar (REST sadece image upload için)
 */
class IkasResponseInterpreter extends base_interpreter_1.BaseResponseInterpreter {
    interpret(response, operationType) {
        if (this.isEmptyResponse(response)) {
            return null;
        }
        try {
            // GraphQL response kontrolü (ikas tüm API'yi GraphQL ile kullanır)
            if (response.errors || response.data) {
                return this.interpretGraphQLResponse(response, operationType);
            }
            // Pagination response (listProduct, listOrder)
            if (response.count !== undefined && response.data && Array.isArray(response.data)) {
                return this.interpretPaginationResponse(response, operationType);
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
                    return this.interpretFulfillment(response);
                default:
                    return this.interpretGeneric(response, operationType);
            }
        }
        catch (error) {
            logger_service_1.logger.error('Error interpreting ikas response', {
                operationType,
                error: error.message
            });
            return null;
        }
    }
    /**
     * GraphQL yanıtını yorumla (ikas'ın ana response formatı)
     */
    interpretGraphQLResponse(response, operationType) {
        const hasErrors = response.errors && response.errors.length > 0;
        if (hasErrors) {
            const errorMessages = response.errors.map((err) => err.message).join(', ');
            return {
                summary: `GraphQL ${operationType} başarısız: ${errorMessages}`,
                success: false,
                failureCount: response.errors.length,
                details: {
                    errors: response.errors,
                    extensions: response.extensions
                },
                parsedAt: new Date()
            };
        }
        // Data içindeki ilk key'i bul (listProduct, fulfillOrder, etc.)
        const data = response.data || response;
        const firstKey = typeof data === 'object' ? Object.keys(data)[0] : null;
        const operationData = firstKey ? data[firstKey] : data;
        // Pagination response check (listProduct, listOrder)
        if (operationData && operationData.count !== undefined && Array.isArray(operationData.data)) {
            return this.interpretPaginationResponse(operationData, operationType);
        }
        return {
            summary: `GraphQL ${operationType} başarılı`,
            success: true,
            successCount: 1,
            details: {
                operation: firstKey,
                resultType: typeof operationData
            },
            parsedAt: new Date()
        };
    }
    /**
     * Pagination yanıtını yorumla (listProduct, listOrder)
     */
    interpretPaginationResponse(response, operationType) {
        var _a;
        const count = response.count || 0;
        const dataLength = ((_a = response.data) === null || _a === void 0 ? void 0 : _a.length) || 0;
        const hasNext = response.hasNext || false;
        const page = response.page || 1;
        const entityName = operationType === operation_type_enum_1.OperationType.FETCH_PRODUCTS ? 'ürün'
            : operationType === operation_type_enum_1.OperationType.FETCH_ORDERS ? 'sipariş'
                : 'kayıt';
        return {
            summary: `${dataLength} ${entityName} getirildi (toplam: ${count}, sayfa: ${page})`,
            success: true,
            successCount: dataLength,
            details: {
                totalCount: count,
                pageCount: dataLength,
                page,
                hasNext
            },
            parsedAt: new Date()
        };
    }
    /**
     * Ürün listesi yanıtını yorumla
     */
    interpretProductList(response) {
        // listProduct response
        const listProduct = response.listProduct || response;
        const products = listProduct.data || [];
        const productCount = products.length;
        return {
            summary: `${productCount} ürün getirildi`,
            success: true,
            successCount: productCount,
            details: {
                productCount,
                totalCount: listProduct.count,
                hasNextPage: listProduct.hasNext
            },
            parsedAt: new Date()
        };
    }
    /**
     * Ürün create/update işlemi yanıtını yorumla
     */
    interpretProductOperation(response, operationType) {
        const product = response.createProduct || response.updateProduct || response;
        const productId = product === null || product === void 0 ? void 0 : product.id;
        const productName = product === null || product === void 0 ? void 0 : product.name;
        return {
            summary: `Ürün ${operationType === operation_type_enum_1.OperationType.SEND_PRODUCTS ? 'oluşturuldu' : 'güncellendi'}: ${productName || productId}`,
            success: true,
            successCount: 1,
            details: {
                productId,
                productName
            },
            parsedAt: new Date()
        };
    }
    /**
     * Sipariş listesi yanıtını yorumla
     */
    interpretOrderList(response) {
        const listOrder = response.listOrder || response;
        const orders = listOrder.data || [];
        const orderCount = orders.length;
        return {
            summary: `${orderCount} sipariş getirildi`,
            success: true,
            successCount: orderCount,
            details: {
                orderCount,
                totalCount: listOrder.count,
                hasNextPage: listOrder.hasNext
            },
            parsedAt: new Date()
        };
    }
    /**
     * Sipariş create/update işlemi yanıtını yorumla
     */
    interpretOrderOperation(response, operationType) {
        var _a;
        const order = response.fulfillOrder || response.updateOrderPackageStatus || response;
        const orderId = order === null || order === void 0 ? void 0 : order.id;
        const orderNumber = order === null || order === void 0 ? void 0 : order.orderNumber;
        const packageCount = ((_a = order === null || order === void 0 ? void 0 : order.orderPackages) === null || _a === void 0 ? void 0 : _a.length) || 0;
        return {
            summary: `Sipariş ${operationType === operation_type_enum_1.OperationType.CREATE_ORDER ? 'karşılandı' : 'güncellendi'}: ${orderNumber || orderId} (${packageCount} paket)`,
            success: true,
            successCount: 1,
            details: {
                orderId,
                orderNumber,
                packageCount
            },
            parsedAt: new Date()
        };
    }
    /**
     * Stok güncelleme yanıtını yorumla (saveVariantStocks)
     */
    interpretStockUpdate(response) {
        const result = response.saveVariantStocks;
        const success = result === true || !!result;
        return {
            summary: success ? 'Stok güncelleme başarılı' : 'Stok güncelleme başarısız',
            success,
            successCount: success ? 1 : 0,
            failureCount: success ? 0 : 1,
            parsedAt: new Date()
        };
    }
    /**
     * Fulfillment (kargo gönderim) yanıtını yorumla
     */
    interpretFulfillment(response) {
        var _a;
        const fulfillment = response.fulfillOrder || response;
        const orderId = fulfillment === null || fulfillment === void 0 ? void 0 : fulfillment.id;
        const orderNumber = fulfillment === null || fulfillment === void 0 ? void 0 : fulfillment.orderNumber;
        const packageCount = ((_a = fulfillment === null || fulfillment === void 0 ? void 0 : fulfillment.orderPackages) === null || _a === void 0 ? void 0 : _a.length) || 0;
        return {
            summary: `Kargo bildirimi başarılı: ${orderNumber || orderId} (${packageCount} paket)`,
            success: true,
            successCount: 1,
            details: {
                orderId,
                orderNumber,
                packageCount
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
exports.IkasResponseInterpreter = IkasResponseInterpreter;
