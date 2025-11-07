"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrendyolResponseInterpreter = void 0;
const operation_type_enum_1 = require("../../enums/operation-type.enum");
const base_interpreter_1 = require("./base.interpreter");
const logger_service_1 = require("../logger.service");
/**
 * Trendyol API yanıtlarını yorumlayan interpreter
 */
class TrendyolResponseInterpreter extends base_interpreter_1.BaseResponseInterpreter {
    interpret(response, operationType) {
        if (this.isEmptyResponse(response)) {
            return null;
        }
        try {
            switch (operationType) {
                case operation_type_enum_1.OperationType.SEND_PRODUCTS:
                case operation_type_enum_1.OperationType.UPDATE_PRODUCTS:
                    return this.interpretProductSendUpdate(response);
                case operation_type_enum_1.OperationType.CREATE_BATCH_REQUEST:
                    return this.interpretBatchRequest(response);
                case operation_type_enum_1.OperationType.GET_BATCH_STATUS:
                    return this.interpretBatchStatus(response);
                case operation_type_enum_1.OperationType.UPDATE_STOCK:
                case operation_type_enum_1.OperationType.UPDATE_PRICES:
                case operation_type_enum_1.OperationType.UPDATE_STOCK_AND_PRICE:
                    return this.interpretStockAndPriceUpdate(response, operationType);
                case operation_type_enum_1.OperationType.GET_CATEGORIES:
                    return this.interpretCategoryList(response);
                case operation_type_enum_1.OperationType.GET_BRANDS:
                    return this.interpretBrandList(response);
                case operation_type_enum_1.OperationType.GET_CATEGORY_ATTRIBUTES:
                    return this.interpretCategoryAttributes(response);
                default:
                    return this.interpretGeneric(response, operationType);
            }
        }
        catch (error) {
            logger_service_1.logger.error('Error interpreting Trendyol response', {
                operationType,
                error: error.message
            });
            return null;
        }
    }
    /**
     * Batch request yanıtını yorumla
     * Örnek response: { batchRequestId: "xxx", itemCount: 15 }
     */
    interpretBatchRequest(response) {
        const batchRequestId = response === null || response === void 0 ? void 0 : response.batchRequestId;
        const itemCount = (response === null || response === void 0 ? void 0 : response.itemCount) || 0;
        return {
            summary: `Batch isteği oluşturuldu: ${itemCount} ürün gönderildi (Batch ID: ${batchRequestId})`,
            success: true,
            successCount: itemCount,
            failureCount: 0,
            details: {
                batchRequestId,
                itemCount
            },
            parsedAt: new Date()
        };
    }
    /**
     * Batch status yanıtını yorumla
     * Örnek response: { items: [{status: "SUCCESS"}, {status: "FAILED"}] }
     */
    interpretBatchStatus(response) {
        const items = (response === null || response === void 0 ? void 0 : response.items) || [];
        const successCount = items.filter((item) => item.status === 'SUCCESS').length;
        const failureCount = items.filter((item) => item.status === 'FAILED' || item.status === 'ERROR').length;
        const pendingCount = items.filter((item) => item.status === 'PENDING' || item.status === 'IN_PROGRESS').length;
        let summary = '';
        if (pendingCount > 0) {
            summary = `Batch durumu: ${successCount} başarılı, ${failureCount} başarısız, ${pendingCount} beklemede`;
        }
        else {
            summary = `Batch tamamlandı: ${successCount} başarılı, ${failureCount} başarısız`;
        }
        return {
            summary,
            success: failureCount === 0,
            successCount,
            failureCount,
            details: {
                total: items.length,
                pending: pendingCount,
                items: items.map((item) => ({
                    barcode: item.barcode,
                    status: item.status,
                    failureReasons: item.failureReasons
                }))
            },
            parsedAt: new Date()
        };
    }
    /**
     * Kategori listesi yanıtını yorumla
     */
    interpretCategoryList(response) {
        const categories = (response === null || response === void 0 ? void 0 : response.categories) || response || [];
        const categoryCount = Array.isArray(categories) ? categories.length : 0;
        return {
            summary: `${categoryCount} kategori getirildi`,
            success: true,
            successCount: categoryCount,
            details: {
                categoryCount,
                hasSubCategories: categories.some((cat) => cat.subCategories && cat.subCategories.length > 0)
            },
            parsedAt: new Date()
        };
    }
    /**
     * Marka listesi yanıtını yorumla
     */
    interpretBrandList(response) {
        const brands = (response === null || response === void 0 ? void 0 : response.brands) || response || [];
        const brandCount = Array.isArray(brands) ? brands.length : 0;
        return {
            summary: `${brandCount} marka getirildi`,
            success: true,
            successCount: brandCount,
            details: {
                brandCount
            },
            parsedAt: new Date()
        };
    }
    /**
     * Kategori attribute'ları yorumla
     */
    interpretCategoryAttributes(response) {
        const attributes = (response === null || response === void 0 ? void 0 : response.categoryAttributes) || (response === null || response === void 0 ? void 0 : response.attributes) || response || [];
        const attributeCount = Array.isArray(attributes) ? attributes.length : 0;
        return {
            summary: `Kategori için ${attributeCount} özellik getirildi`,
            success: true,
            successCount: attributeCount,
            details: {
                attributeCount,
                requiredCount: attributes.filter((attr) => attr.required).length
            },
            parsedAt: new Date()
        };
    }
    /**
     * Stok ve/veya fiyat güncelleme yanıtını yorumla
     * Trendyol stok/fiyat güncelleme endpoint'i batchRequestId döndürebilir
     */
    interpretStockAndPriceUpdate(response, operationType) {
        var _a, _b, _c, _d;
        // BatchRequestId varsa - asenkron işlem
        if (response === null || response === void 0 ? void 0 : response.batchRequestId) {
            const batchRequestId = response.batchRequestId;
            const itemCount = (response === null || response === void 0 ? void 0 : response.itemCount) || ((_a = response === null || response === void 0 ? void 0 : response.items) === null || _a === void 0 ? void 0 : _a.length) || 0;
            return {
                summary: `Batch isteği oluşturuldu (Batch ID: ${batchRequestId}${itemCount > 0 ? `, ${itemCount} ürün` : ''})`,
                success: true,
                successCount: itemCount,
                failureCount: 0,
                details: {
                    batchRequestId,
                    itemCount,
                    operationType: operationType
                },
                parsedAt: new Date()
            };
        }
        // Direkt success response - senkron işlem
        if ((response === null || response === void 0 ? void 0 : response.status) === 'SUCCESS' || (response === null || response === void 0 ? void 0 : response.success) === true) {
            const itemCount = (response === null || response === void 0 ? void 0 : response.itemCount) || (response === null || response === void 0 ? void 0 : response.updatedCount) || 1;
            return {
                summary: `${itemCount} ürün başarıyla güncellendi`,
                success: true,
                successCount: itemCount,
                failureCount: 0,
                details: {
                    itemCount,
                    operationType: operationType
                },
                parsedAt: new Date()
            };
        }
        // Hata durumu
        if ((response === null || response === void 0 ? void 0 : response.errors) || (response === null || response === void 0 ? void 0 : response.error)) {
            const errorMessage = ((_c = (_b = response === null || response === void 0 ? void 0 : response.errors) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.message) || ((_d = response === null || response === void 0 ? void 0 : response.error) === null || _d === void 0 ? void 0 : _d.message) || 'Bilinmeyen hata';
            return {
                summary: `Güncelleme başarısız: ${errorMessage}`,
                success: false,
                successCount: 0,
                failureCount: 1,
                details: {
                    error: errorMessage,
                    operationType: operationType
                },
                parsedAt: new Date()
            };
        }
        // Genel yanıt - belirsiz durum
        return {
            summary: `${operationType} işlemi tamamlandı`,
            success: true,
            details: {
                operationType: operationType,
                responseType: typeof response
            },
            parsedAt: new Date()
        };
    }
    /**
     * Ürün gönderimi/güncelleme yanıtını yorumla
     * BatchRequestId, success/fail sayıları, hata nedenleri içerebilir
     */
    interpretProductSendUpdate(response) {
        // BatchRequestId varsa
        if (response === null || response === void 0 ? void 0 : response.batchRequestId) {
            const batchRequestId = response.batchRequestId;
            const itemCount = (response === null || response === void 0 ? void 0 : response.itemCount) || 0;
            return {
                summary: `${itemCount} ürün gönderildi (Batch ID: ${batchRequestId})`,
                success: true,
                successCount: itemCount,
                failureCount: 0,
                details: {
                    batchRequestId,
                    itemCount
                },
                parsedAt: new Date()
            };
        }
        // Success/fail items varsa
        if ((response === null || response === void 0 ? void 0 : response.items) && Array.isArray(response.items)) {
            const successCount = response.items.filter((item) => item.status === 'SUCCESS').length;
            const failureCount = response.items.filter((item) => item.status === 'FAILED' || item.status === 'ERROR').length;
            const failedItems = response.items.filter((item) => (item.status === 'FAILED' || item.status === 'ERROR') && item.failureReasons);
            let summary = `${successCount} başarılı, ${failureCount} başarısız`;
            return {
                summary,
                success: failureCount === 0,
                successCount,
                failureCount,
                details: {
                    total: response.items.length,
                    items: failedItems.map((item) => ({
                        barcode: item.barcode || item.id,
                        failureReasons: item.failureReasons
                    }))
                },
                parsedAt: new Date()
            };
        }
        // Genel başarı yanıtı
        return {
            summary: 'Ürün işlemi tamamlandı',
            success: true,
            details: {
                responseType: typeof response,
                hasData: !this.isEmptyResponse(response)
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
exports.TrendyolResponseInterpreter = TrendyolResponseInterpreter;
//# sourceMappingURL=trendyol.interpreter.js.map