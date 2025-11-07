"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopifyResponseInterpreter = void 0;
const operation_type_enum_1 = require("../../enums/operation-type.enum");
const base_interpreter_1 = require("./base.interpreter");
const logger_service_1 = require("../logger.service");
/**
 * Shopify API yanıtlarını yorumlayan interpreter
 */
class ShopifyResponseInterpreter extends base_interpreter_1.BaseResponseInterpreter {
    interpret(response, operationType) {
        if (this.isEmptyResponse(response)) {
            return null;
        }
        try {
            // GraphQL response kontrolü
            if (response.data || response.errors) {
                return this.interpretGraphQLResponse(response, operationType);
            }
            // REST API response
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
                    return this.interpretInventoryUpdate(response);
                default:
                    return this.interpretGeneric(response, operationType);
            }
        }
        catch (error) {
            logger_service_1.logger.error('Error interpreting Shopify response', {
                operationType,
                error: error.message
            });
            return null;
        }
    }
    /**
     * GraphQL yanıtını yorumla
     */
    interpretGraphQLResponse(response, operationType) {
        const hasErrors = response.errors && response.errors.length > 0;
        const hasData = response.data && Object.keys(response.data).length > 0;
        if (hasErrors) {
            const errorMessages = response.errors.map((err) => err.message).join(', ');
            return {
                summary: `GraphQL işlemi başarısız: ${errorMessages}`,
                success: false,
                failureCount: response.errors.length,
                details: {
                    errors: response.errors,
                    extensions: response.extensions
                },
                parsedAt: new Date()
            };
        }
        if (hasData) {
            const firstKey = Object.keys(response.data)[0];
            const operation = response.data[firstKey];
            return {
                summary: `GraphQL ${operationType} işlemi başarılı`,
                success: true,
                successCount: 1,
                details: {
                    operation: firstKey,
                    userErrors: (operation === null || operation === void 0 ? void 0 : operation.userErrors) || [],
                    extensions: response.extensions
                },
                parsedAt: new Date()
            };
        }
        return {
            summary: 'GraphQL yanıtı boş',
            success: false,
            parsedAt: new Date()
        };
    }
    /**
     * Ürün işlemi (create/update) yanıtını yorumla
     */
    interpretProductOperation(response) {
        var _a;
        const product = response === null || response === void 0 ? void 0 : response.product;
        const productId = product === null || product === void 0 ? void 0 : product.id;
        const title = product === null || product === void 0 ? void 0 : product.title;
        const variantCount = ((_a = product === null || product === void 0 ? void 0 : product.variants) === null || _a === void 0 ? void 0 : _a.length) || 0;
        return {
            summary: `Ürün işlemi başarılı: ${title || productId} (${variantCount} varyant)`,
            success: true,
            successCount: 1,
            details: {
                productId,
                title,
                variantCount,
                status: product === null || product === void 0 ? void 0 : product.status
            },
            parsedAt: new Date()
        };
    }
    /**
     * Ürün listesi yanıtını yorumla
     */
    interpretProductList(response) {
        var _a;
        const products = (response === null || response === void 0 ? void 0 : response.products) || [];
        const productCount = products.length;
        return {
            summary: `${productCount} ürün getirildi`,
            success: true,
            successCount: productCount,
            details: {
                productCount,
                hasNextPage: !!((_a = response === null || response === void 0 ? void 0 : response.pageInfo) === null || _a === void 0 ? void 0 : _a.hasNextPage)
            },
            parsedAt: new Date()
        };
    }
    /**
     * Sipariş işlemi (create/update) yanıtını yorumla
     */
    interpretOrderOperation(response) {
        const order = response === null || response === void 0 ? void 0 : response.order;
        const orderId = order === null || order === void 0 ? void 0 : order.id;
        const orderNumber = (order === null || order === void 0 ? void 0 : order.order_number) || (order === null || order === void 0 ? void 0 : order.name);
        const totalPrice = order === null || order === void 0 ? void 0 : order.total_price;
        return {
            summary: `Sipariş işlemi başarılı: ${orderNumber || orderId} (${totalPrice})`,
            success: true,
            successCount: 1,
            details: {
                orderId,
                orderNumber,
                totalPrice,
                status: order === null || order === void 0 ? void 0 : order.financial_status,
                fulfillmentStatus: order === null || order === void 0 ? void 0 : order.fulfillment_status
            },
            parsedAt: new Date()
        };
    }
    /**
     * Sipariş listesi yanıtını yorumla
     */
    interpretOrderList(response) {
        var _a;
        const orders = (response === null || response === void 0 ? void 0 : response.orders) || [];
        const orderCount = orders.length;
        return {
            summary: `${orderCount} sipariş getirildi`,
            success: true,
            successCount: orderCount,
            details: {
                orderCount,
                hasNextPage: !!((_a = response === null || response === void 0 ? void 0 : response.pageInfo) === null || _a === void 0 ? void 0 : _a.hasNextPage)
            },
            parsedAt: new Date()
        };
    }
    /**
     * Stok güncelleme yanıtını yorumla
     */
    interpretInventoryUpdate(response) {
        const inventoryLevel = response === null || response === void 0 ? void 0 : response.inventory_level;
        const available = inventoryLevel === null || inventoryLevel === void 0 ? void 0 : inventoryLevel.available;
        return {
            summary: `Stok güncellendi: ${available} adet mevcut`,
            success: true,
            successCount: 1,
            details: {
                available,
                inventoryItemId: inventoryLevel === null || inventoryLevel === void 0 ? void 0 : inventoryLevel.inventory_item_id,
                locationId: inventoryLevel === null || inventoryLevel === void 0 ? void 0 : inventoryLevel.location_id
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
exports.ShopifyResponseInterpreter = ShopifyResponseInterpreter;
//# sourceMappingURL=shopify.interpreter.js.map