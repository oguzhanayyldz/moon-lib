"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CicekSepetiResponseInterpreter = void 0;
const operation_type_enum_1 = require("../../enums/operation-type.enum");
const base_interpreter_1 = require("./base.interpreter");
const logger_service_1 = require("../logger.service");
/**
 * Çiçeksepeti API response interpreter
 *
 * Çiçeksepeti API'sinin response yapıları:
 *   - Order/GetOrders → { orderListCount, supplierOrderListWithBranch: [...] }
 *   - Order/getcanceledorders → { orderItemList: [...] }
 *   - Order/cancelevaluation → { isSuccess, message }
 *   - Order/refundprocessstartreceivedprocess → { orderItems: [...] }
 *   - Products POST/PUT/price-and-stock → { batchId } (async)
 *   - Products/batch-status/{batchId} → { batchId, itemCount, items: [{status: "Pending|Processing|Success|Failed|Warning"}] }
 *   - Products GET → { totalCount, products: [...] }
 *   - Categories GET → { categories: [...] (tree) }
 *   - Categories/{id}/attributes → { categoryAttributes: [...] }
 *   - sellerquestions GET → { items: [...], hasNextPage }
 */
class CicekSepetiResponseInterpreter extends base_interpreter_1.BaseResponseInterpreter {
    interpret(response, operationType) {
        if (this.isEmptyResponse(response)) {
            return null;
        }
        try {
            switch (operationType) {
                case operation_type_enum_1.OperationType.SEND_PRODUCTS:
                case operation_type_enum_1.OperationType.UPDATE_PRODUCTS:
                case operation_type_enum_1.OperationType.UPDATE_STOCK:
                case operation_type_enum_1.OperationType.UPDATE_PRICES:
                case operation_type_enum_1.OperationType.UPDATE_STOCK_AND_PRICE:
                    return this.interpretBatchSubmit(response, operationType);
                case operation_type_enum_1.OperationType.GET_BATCH_STATUS:
                    return this.interpretBatchStatus(response);
                case operation_type_enum_1.OperationType.FETCH_PRODUCTS:
                    return this.interpretProductList(response);
                case operation_type_enum_1.OperationType.FETCH_ORDERS:
                    return this.interpretOrderOrRefundList(response);
                case operation_type_enum_1.OperationType.UPDATE_ORDER:
                    return this.interpretOrderUpdate(response);
                case operation_type_enum_1.OperationType.GET_CATEGORIES:
                    return this.interpretCategoryList(response);
                case operation_type_enum_1.OperationType.GET_CATEGORY_ATTRIBUTES:
                    return this.interpretCategoryAttributes(response);
                default:
                    return this.interpretGeneric(response, operationType);
            }
        }
        catch (error) {
            logger_service_1.logger.error('Error interpreting CicekSepeti response', {
                operationType,
                error: error.message
            });
            return null;
        }
    }
    /**
     * Batch submit yanıtını yorumla — POST /Products, PUT /Products, PUT /Products/price-and-stock
     * Response: { batchId: "uuid-..." }
     */
    interpretBatchSubmit(response, operationType) {
        const batchId = response === null || response === void 0 ? void 0 : response.batchId;
        if (batchId) {
            return {
                summary: `Batch isteği oluşturuldu (Batch ID: ${batchId})`,
                success: true,
                successCount: 0, // gerçek sonuç batch-status üzerinden alınır
                failureCount: 0,
                details: {
                    batchId,
                    operationType
                },
                parsedAt: new Date()
            };
        }
        // Hata durumu (Çiçeksepeti 4xx)
        if ((response === null || response === void 0 ? void 0 : response.code) || (response === null || response === void 0 ? void 0 : response.message)) {
            return {
                summary: `Batch isteği başarısız: ${response.message || 'Bilinmeyen hata'}`,
                success: false,
                successCount: 0,
                failureCount: 1,
                details: {
                    errorCode: response.code,
                    errorMessage: response.message,
                    operationType
                },
                parsedAt: new Date()
            };
        }
        return this.interpretGeneric(response, operationType);
    }
    /**
     * Batch status yanıtını yorumla
     * Response: { batchId, itemCount, items: [{itemId, status: "Pending|Processing|Success|Failed|Warning", failureReasons}] }
     */
    interpretBatchStatus(response) {
        var _a;
        const items = Array.isArray(response === null || response === void 0 ? void 0 : response.items) ? response.items : [];
        const successCount = items.filter((item) => item.status === 'Success').length;
        const failureCount = items.filter((item) => item.status === 'Failed').length;
        const warningCount = items.filter((item) => item.status === 'Warning').length;
        const pendingCount = items.filter((item) => item.status === 'Pending' || item.status === 'Processing').length;
        let summary = '';
        if (pendingCount > 0) {
            summary = `Batch durumu: ${successCount} başarılı, ${failureCount} başarısız, ${warningCount} uyarılı, ${pendingCount} beklemede`;
        }
        else {
            summary = `Batch tamamlandı: ${successCount} başarılı, ${failureCount} başarısız, ${warningCount} uyarılı`;
        }
        return {
            summary,
            success: failureCount === 0,
            successCount,
            failureCount,
            details: {
                batchId: response === null || response === void 0 ? void 0 : response.batchId,
                total: (_a = response === null || response === void 0 ? void 0 : response.itemCount) !== null && _a !== void 0 ? _a : items.length,
                pending: pendingCount,
                warning: warningCount,
                failures: items
                    .filter((item) => item.status === 'Failed')
                    .map((item) => ({
                    itemId: item.itemId,
                    failureReasons: item.failureReasons,
                    data: item.data
                }))
            },
            parsedAt: new Date()
        };
    }
    /**
     * Ürün listeleme yanıtını yorumla
     * Response: { totalCount, products: [...] }
     */
    interpretProductList(response) {
        var _a;
        const products = Array.isArray(response === null || response === void 0 ? void 0 : response.products) ? response.products : [];
        const totalCount = (_a = response === null || response === void 0 ? void 0 : response.totalCount) !== null && _a !== void 0 ? _a : products.length;
        return {
            summary: `${totalCount} ürün getirildi (sayfa: ${products.length})`,
            success: true,
            successCount: products.length,
            details: {
                totalCount,
                pageItemCount: products.length
            },
            parsedAt: new Date()
        };
    }
    /**
     * Sipariş veya iade listeleme yanıtını yorumla
     * Order/GetOrders → { orderListCount, supplierOrderListWithBranch: [...] }
     * Order/getcanceledorders → { orderItemList: [...] }
     */
    interpretOrderOrRefundList(response) {
        var _a;
        // Sipariş listesi
        if (Array.isArray(response === null || response === void 0 ? void 0 : response.supplierOrderListWithBranch)) {
            const items = response.supplierOrderListWithBranch;
            const totalCount = (_a = response.orderListCount) !== null && _a !== void 0 ? _a : items.length;
            return {
                summary: `${totalCount} sipariş kaydı getirildi (sayfa: ${items.length})`,
                success: true,
                successCount: items.length,
                details: {
                    totalCount,
                    pageItemCount: items.length
                },
                parsedAt: new Date()
            };
        }
        // İade listesi
        if (Array.isArray(response === null || response === void 0 ? void 0 : response.orderItemList)) {
            const items = response.orderItemList;
            return {
                summary: `${items.length} iade siparişi getirildi`,
                success: true,
                successCount: items.length,
                details: {
                    pageItemCount: items.length
                },
                parsedAt: new Date()
            };
        }
        return this.interpretGeneric(response, operation_type_enum_1.OperationType.FETCH_ORDERS);
    }
    /**
     * Sipariş güncelleme yanıtını yorumla
     * Order/cancelevaluation → { isSuccess, message }
     * Order/refundprocessstartreceivedprocess → { orderItems: [{orderItemId, isSuccess, validation}] }
     */
    interpretOrderUpdate(response) {
        // cancelevaluation single-result
        if (typeof (response === null || response === void 0 ? void 0 : response.isSuccess) === 'boolean' && !Array.isArray(response === null || response === void 0 ? void 0 : response.orderItems)) {
            return {
                summary: response.isSuccess
                    ? 'Sipariş güncelleme başarılı'
                    : `Sipariş güncelleme başarısız: ${response.message || 'Bilinmeyen hata'}`,
                success: response.isSuccess,
                successCount: response.isSuccess ? 1 : 0,
                failureCount: response.isSuccess ? 0 : 1,
                details: {
                    message: response.message
                },
                parsedAt: new Date()
            };
        }
        // refundprocess multi-item
        if (Array.isArray(response === null || response === void 0 ? void 0 : response.orderItems)) {
            const items = response.orderItems;
            const successCount = items.filter((x) => x.isSuccess === true).length;
            const failureCount = items.filter((x) => x.isSuccess === false).length;
            return {
                summary: `${successCount} item başarılı, ${failureCount} başarısız`,
                success: failureCount === 0,
                successCount,
                failureCount,
                details: {
                    items: items.map((x) => ({
                        orderItemId: x.orderItemId,
                        isSuccess: x.isSuccess,
                        validation: x.validation
                    }))
                },
                parsedAt: new Date()
            };
        }
        return this.interpretGeneric(response, operation_type_enum_1.OperationType.UPDATE_ORDER);
    }
    /**
     * Kategori listesi yanıtını yorumla (tree yapısı)
     * Response: { categories: [{id, name, parentCategoryId, subCategories: [...]}] }
     */
    interpretCategoryList(response) {
        const categories = Array.isArray(response === null || response === void 0 ? void 0 : response.categories) ? response.categories : [];
        // Recursive flat count
        const countNodes = (nodes) => {
            let total = 0;
            for (const node of nodes) {
                total++;
                if (Array.isArray(node.subCategories)) {
                    total += countNodes(node.subCategories);
                }
            }
            return total;
        };
        const totalNodes = countNodes(categories);
        return {
            summary: `${totalNodes} kategori (root: ${categories.length})`,
            success: true,
            successCount: totalNodes,
            details: {
                rootCount: categories.length,
                totalCount: totalNodes
            },
            parsedAt: new Date()
        };
    }
    /**
     * Kategori öznitelik yanıtını yorumla
     * Response: { categoryId, categoryName, categoryAttributes: [...] }
     */
    interpretCategoryAttributes(response) {
        const attributes = Array.isArray(response === null || response === void 0 ? void 0 : response.categoryAttributes) ? response.categoryAttributes : [];
        const requiredCount = attributes.filter((a) => a.required === true).length;
        const variantCount = attributes.filter((a) => a.varianter === true).length;
        return {
            summary: `Kategori için ${attributes.length} özellik getirildi (${requiredCount} zorunlu, ${variantCount} varyant)`,
            success: true,
            successCount: attributes.length,
            details: {
                categoryId: response === null || response === void 0 ? void 0 : response.categoryId,
                categoryName: response === null || response === void 0 ? void 0 : response.categoryName,
                attributeCount: attributes.length,
                requiredCount,
                variantCount
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
                operationType,
                responseType: typeof response,
                hasData: !this.isEmptyResponse(response)
            },
            parsedAt: new Date()
        };
    }
}
exports.CicekSepetiResponseInterpreter = CicekSepetiResponseInterpreter;
