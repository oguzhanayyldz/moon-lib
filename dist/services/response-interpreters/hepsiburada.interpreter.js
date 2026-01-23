"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HepsiburadaResponseInterpreter = void 0;
const operation_type_enum_1 = require("../../enums/operation-type.enum");
const base_interpreter_1 = require("./base.interpreter");
const logger_service_1 = require("../logger.service");
/**
 * Hepsiburada API yanıtlarını yorumlayan interpreter
 *
 * Hepsiburada API Response Formatları:
 * - Batch Status (Ticket API): { success: true, data: [{ importStatus, productStatus, validationResults }] }
 * - Batch Status (Tracking): { status, summary: { total, success, failed }, successItems, failedItems }
 * - Tracking: { trackingId: "xxx" }
 * - Categories: { data: { categories: [...] } }
 * - Brands: { data: { brands: [...] } }
 */
class HepsiburadaResponseInterpreter extends base_interpreter_1.BaseResponseInterpreter {
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
            logger_service_1.logger.error('Error interpreting Hepsiburada response', {
                operationType,
                error: error.message
            });
            return null;
        }
    }
    /**
     * Batch request (ürün upload) yanıtını yorumla
     * Hepsiburada response: { trackingId: "xxx" }
     */
    interpretBatchRequest(response) {
        var _a;
        const trackingId = (response === null || response === void 0 ? void 0 : response.trackingId) || ((_a = response === null || response === void 0 ? void 0 : response.data) === null || _a === void 0 ? void 0 : _a.trackingId);
        const itemCount = (response === null || response === void 0 ? void 0 : response.itemCount) || 0;
        return {
            summary: `Batch isteği oluşturuldu (Tracking ID: ${trackingId}${itemCount > 0 ? `, ${itemCount} ürün` : ''})`,
            success: !!trackingId,
            successCount: itemCount,
            failureCount: 0,
            details: {
                trackingId,
                itemCount
            },
            parsedAt: new Date()
        };
    }
    /**
     * Batch status (tracking status) yanıtını yorumla
     *
     * İki farklı format desteklenir:
     *
     * 1. Batch Tracking Format (processBatchResults'tan gelen - fiyat/stok):
     * {
     *   "trackingId": "xxx",
     *   "status": "COMPLETED" | "PARTIAL" | "FAILED",
     *   "summary": { "total": 1, "success": 1, "failed": 0 },
     *   "successItems": [{ "hbSku": "xxx", "status": "SUCCESS" }],
     *   "failedItems": []
     * }
     *
     * 2. Ticket API Format (ürün upload sonuçları):
     * {
     *   "success": true,
     *   "data": [{
     *     "merchantSku": "xxx",
     *     "importStatus": "SUCCESS" | "FAILED",
     *     "productStatus": "ForSale" | "Rejected",
     *     "validationResults": [{ "attributeName": "...", "message": "..." }]
     *   }]
     * }
     */
    interpretBatchStatus(response) {
        // YENİ: Batch tracking formatını kontrol et (processBatchResults'tan gelen)
        // Bu format: { status, summary: { total, success, failed }, successItems, failedItems }
        if ((response === null || response === void 0 ? void 0 : response.summary) && typeof response.summary === 'object') {
            return this.interpretBatchTrackingFormat(response);
        }
        // ESKİ: Ticket API formatı (ürün upload sonuçları)
        // Bu format: { data: [{ importStatus, productStatus, ... }] }
        return this.interpretTicketApiFormat(response);
    }
    /**
     * Batch tracking formatını yorumla (processBatchResults'tan gelen)
     * Format: { trackingId, status, summary: { total, success, failed }, successItems, failedItems }
     */
    interpretBatchTrackingFormat(response) {
        var _a, _b, _c, _d;
        const summary = response.summary || {};
        const status = response.status; // "COMPLETED", "PARTIAL", "FAILED"
        const successCount = summary.success || 0;
        const failureCount = summary.failed || 0;
        const totalCount = summary.total || (successCount + failureCount);
        // Status mapping
        let interpretedStatus = 'pending';
        if (status === 'COMPLETED')
            interpretedStatus = 'completed';
        else if (status === 'PARTIAL')
            interpretedStatus = 'partial';
        else if (status === 'FAILED')
            interpretedStatus = 'failed';
        // Özet mesaj
        let summaryMessage = '';
        if (interpretedStatus === 'completed') {
            summaryMessage = `Batch tamamlandı: ${successCount} ürün başarılı`;
        }
        else if (interpretedStatus === 'failed') {
            summaryMessage = `Batch başarısız: ${failureCount} ürün reddedildi`;
        }
        else if (interpretedStatus === 'partial') {
            summaryMessage = `Batch kısmen başarılı: ${successCount} başarılı, ${failureCount} başarısız`;
        }
        else {
            summaryMessage = 'Batch durumu: İşleniyor...';
        }
        return {
            summary: summaryMessage,
            success: failureCount === 0 && totalCount > 0,
            successCount,
            failureCount,
            details: {
                total: totalCount,
                status: interpretedStatus,
                warningsCount: ((_a = response.validationWarnings) === null || _a === void 0 ? void 0 : _a.length) || 0,
                successItems: ((_b = response.successItems) === null || _b === void 0 ? void 0 : _b.slice(0, 20)) || [],
                failedItems: ((_c = response.failedItems) === null || _c === void 0 ? void 0 : _c.slice(0, 20)) || [],
                itemsWithWarnings: ((_d = response.validationWarnings) === null || _d === void 0 ? void 0 : _d.slice(0, 20)) || []
            },
            parsedAt: new Date()
        };
    }
    /**
     * Ticket API formatını yorumla (ürün upload sonuçları)
     * Format: { data: [{ merchantSku, importStatus, productStatus, validationResults }] }
     */
    interpretTicketApiFormat(response) {
        // Hepsiburada data array olarak dönüyor
        const rawData = (response === null || response === void 0 ? void 0 : response.data) || response;
        const items = Array.isArray(rawData) ? rawData : ((rawData === null || rawData === void 0 ? void 0 : rawData.data) || []);
        const successItems = items.filter((item) => item.importStatus === 'SUCCESS');
        const failedItems = items.filter((item) => item.importStatus === 'FAILED');
        const itemsWithWarnings = successItems.filter((item) => item.validationResults && item.validationResults.length > 0);
        const successCount = successItems.length;
        const failureCount = failedItems.length;
        const totalCount = items.length;
        // Status belirleme
        let status = 'pending';
        if (totalCount > 0) {
            if (failureCount === 0)
                status = 'completed';
            else if (successCount === 0)
                status = 'failed';
            else
                status = 'partial';
        }
        // Özet mesaj oluştur
        let summary = '';
        if (totalCount === 0) {
            summary = 'Batch durumu: Henüz sonuç yok';
        }
        else if (status === 'completed') {
            summary = `Batch tamamlandı: ${successCount} ürün başarılı`;
            if (itemsWithWarnings.length > 0) {
                summary += ` (${itemsWithWarnings.length} uyarı ile)`;
            }
        }
        else if (status === 'failed') {
            summary = `Batch başarısız: ${failureCount} ürün reddedildi`;
        }
        else {
            summary = `Batch kısmen başarılı: ${successCount} başarılı, ${failureCount} başarısız`;
        }
        return {
            summary,
            success: failureCount === 0 && totalCount > 0,
            successCount,
            failureCount,
            details: {
                total: totalCount,
                status,
                warningsCount: itemsWithWarnings.length,
                // Başarılı ürünler (ilk 20)
                successItems: successItems.slice(0, 20).map((item) => ({
                    merchantSku: item.merchantSku,
                    barcode: item.barcode,
                    hbSku: item.hbSku,
                    productStatus: item.productStatus
                })),
                // Başarısız ürünler - detaylı hata bilgisi ile
                failedItems: failedItems.slice(0, 20).map((item) => {
                    var _a;
                    return ({
                        merchantSku: item.merchantSku,
                        barcode: item.barcode,
                        productStatus: item.productStatus,
                        errors: ((_a = item.validationResults) === null || _a === void 0 ? void 0 : _a.map((v) => `${v.attributeName}: ${v.message}`)) || []
                    });
                }),
                // Uyarılı ürünler (SUCCESS ama validation warnings var)
                itemsWithWarnings: itemsWithWarnings.slice(0, 20).map((item) => {
                    var _a;
                    return ({
                        merchantSku: item.merchantSku,
                        productStatus: item.productStatus,
                        warnings: ((_a = item.validationResults) === null || _a === void 0 ? void 0 : _a.map((v) => `${v.attributeName}: ${v.message}`)) || []
                    });
                })
            },
            parsedAt: new Date()
        };
    }
    /**
     * Kategori listesi yanıtını yorumla
     * Hepsiburada response: { data: { categories: [...] } }
     */
    interpretCategoryList(response) {
        var _a;
        const categories = ((_a = response === null || response === void 0 ? void 0 : response.data) === null || _a === void 0 ? void 0 : _a.categories) || (response === null || response === void 0 ? void 0 : response.categories) || (response === null || response === void 0 ? void 0 : response.data) || [];
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
     * Hepsiburada response: { data: { brands: [...] } }
     */
    interpretBrandList(response) {
        var _a;
        const brands = ((_a = response === null || response === void 0 ? void 0 : response.data) === null || _a === void 0 ? void 0 : _a.brands) || (response === null || response === void 0 ? void 0 : response.brands) || (response === null || response === void 0 ? void 0 : response.data) || [];
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
     * Hepsiburada response: { data: { attributes: [...] } }
     */
    interpretCategoryAttributes(response) {
        var _a, _b;
        const attributes = ((_a = response === null || response === void 0 ? void 0 : response.data) === null || _a === void 0 ? void 0 : _a.baseAttributes) ||
            ((_b = response === null || response === void 0 ? void 0 : response.data) === null || _b === void 0 ? void 0 : _b.attributes) ||
            (response === null || response === void 0 ? void 0 : response.attributes) ||
            (response === null || response === void 0 ? void 0 : response.data) || [];
        const attributeCount = Array.isArray(attributes) ? attributes.length : 0;
        const requiredCount = attributes.filter((attr) => attr.mandatory || attr.required).length;
        return {
            summary: `Kategori için ${attributeCount} özellik getirildi (${requiredCount} zorunlu)`,
            success: true,
            successCount: attributeCount,
            details: {
                attributeCount,
                requiredCount
            },
            parsedAt: new Date()
        };
    }
    /**
     * Stok ve/veya fiyat güncelleme yanıtını yorumla
     * Hepsiburada stok/fiyat güncelleme trackingId döndürebilir
     */
    interpretStockAndPriceUpdate(response, operationType) {
        var _a, _b, _c;
        // TrackingId varsa - asenkron işlem
        if (response === null || response === void 0 ? void 0 : response.trackingId) {
            const trackingId = response.trackingId;
            const itemCount = (response === null || response === void 0 ? void 0 : response.itemCount) || 0;
            return {
                summary: `Güncelleme isteği oluşturuldu (Tracking ID: ${trackingId}${itemCount > 0 ? `, ${itemCount} ürün` : ''})`,
                success: true,
                successCount: itemCount,
                failureCount: 0,
                details: {
                    trackingId,
                    itemCount,
                    operationType
                },
                parsedAt: new Date()
            };
        }
        // Direkt success response
        if ((response === null || response === void 0 ? void 0 : response.success) === true || (response === null || response === void 0 ? void 0 : response.status) === 'SUCCESS') {
            const itemCount = (response === null || response === void 0 ? void 0 : response.itemCount) || (response === null || response === void 0 ? void 0 : response.updatedCount) || 1;
            return {
                summary: `${itemCount} ürün başarıyla güncellendi`,
                success: true,
                successCount: itemCount,
                failureCount: 0,
                details: {
                    itemCount,
                    operationType
                },
                parsedAt: new Date()
            };
        }
        // Hata durumu
        if ((response === null || response === void 0 ? void 0 : response.errors) || (response === null || response === void 0 ? void 0 : response.error) || (response === null || response === void 0 ? void 0 : response.success) === false) {
            const errorMessage = ((_b = (_a = response === null || response === void 0 ? void 0 : response.errors) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) ||
                ((_c = response === null || response === void 0 ? void 0 : response.error) === null || _c === void 0 ? void 0 : _c.message) ||
                (response === null || response === void 0 ? void 0 : response.message) ||
                'Bilinmeyen hata';
            return {
                summary: `Güncelleme başarısız: ${errorMessage}`,
                success: false,
                successCount: 0,
                failureCount: 1,
                details: {
                    error: errorMessage,
                    operationType
                },
                parsedAt: new Date()
            };
        }
        // Genel yanıt
        return {
            summary: `${operationType} işlemi tamamlandı`,
            success: true,
            details: {
                operationType,
                responseType: typeof response
            },
            parsedAt: new Date()
        };
    }
    /**
     * Ürün gönderimi/güncelleme yanıtını yorumla
     * TrackingId veya success/fail bilgisi içerebilir
     */
    interpretProductSendUpdate(response) {
        var _a, _b, _c;
        // TrackingId varsa - asenkron batch işlemi
        if (response === null || response === void 0 ? void 0 : response.trackingId) {
            return this.interpretBatchRequest(response);
        }
        // Data array varsa - batch status gibi işle
        const rawData = (response === null || response === void 0 ? void 0 : response.data) || response;
        if (Array.isArray(rawData) && rawData.length > 0 && ((_a = rawData[0]) === null || _a === void 0 ? void 0 : _a.importStatus)) {
            return this.interpretBatchStatus(response);
        }
        // Success response
        if ((response === null || response === void 0 ? void 0 : response.success) === true) {
            return {
                summary: 'Ürün işlemi başarılı',
                success: true,
                successCount: 1,
                failureCount: 0,
                details: {
                    hasData: !this.isEmptyResponse(response)
                },
                parsedAt: new Date()
            };
        }
        // Hata response
        if ((response === null || response === void 0 ? void 0 : response.success) === false || (response === null || response === void 0 ? void 0 : response.errors)) {
            const errorMessage = ((_c = (_b = response === null || response === void 0 ? void 0 : response.errors) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.message) ||
                (response === null || response === void 0 ? void 0 : response.message) ||
                'Bilinmeyen hata';
            return {
                summary: `Ürün işlemi başarısız: ${errorMessage}`,
                success: false,
                successCount: 0,
                failureCount: 1,
                details: {
                    error: errorMessage
                },
                parsedAt: new Date()
            };
        }
        // Genel yanıt
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
        // Hepsiburada genel success kontrolü
        const isSuccess = (response === null || response === void 0 ? void 0 : response.success) !== false;
        return {
            summary: `${operationType} işlemi ${isSuccess ? 'tamamlandı' : 'başarısız'}`,
            success: isSuccess,
            details: {
                responseType: typeof response,
                hasData: !this.isEmptyResponse(response)
            },
            parsedAt: new Date()
        };
    }
}
exports.HepsiburadaResponseInterpreter = HepsiburadaResponseInterpreter;
