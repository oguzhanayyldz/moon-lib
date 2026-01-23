import { OperationType } from '../../enums/operation-type.enum';
import { InterpretedResponse } from '../../models/integrationRequestLog.schema';
import { BaseResponseInterpreter } from './base.interpreter';
import { logger } from '../logger.service';

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
export class HepsiburadaResponseInterpreter extends BaseResponseInterpreter {
    interpret(response: any, operationType: OperationType): InterpretedResponse | null {
        if (this.isEmptyResponse(response)) {
            return null;
        }

        try {
            switch (operationType) {
                case OperationType.SEND_PRODUCTS:
                case OperationType.UPDATE_PRODUCTS:
                    return this.interpretProductSendUpdate(response);

                case OperationType.CREATE_BATCH_REQUEST:
                    return this.interpretBatchRequest(response);

                case OperationType.GET_BATCH_STATUS:
                    return this.interpretBatchStatus(response);

                case OperationType.UPDATE_STOCK:
                case OperationType.UPDATE_PRICES:
                case OperationType.UPDATE_STOCK_AND_PRICE:
                    return this.interpretStockAndPriceUpdate(response, operationType);

                case OperationType.GET_CATEGORIES:
                    return this.interpretCategoryList(response);

                case OperationType.GET_BRANDS:
                    return this.interpretBrandList(response);

                case OperationType.GET_CATEGORY_ATTRIBUTES:
                    return this.interpretCategoryAttributes(response);

                default:
                    return this.interpretGeneric(response, operationType);
            }
        } catch (error) {
            logger.error('Error interpreting Hepsiburada response', {
                operationType,
                error: (error as Error).message
            });
            return null;
        }
    }

    /**
     * Batch request (ürün upload) yanıtını yorumla
     * Hepsiburada response: { trackingId: "xxx" }
     */
    private interpretBatchRequest(response: any): InterpretedResponse {
        const trackingId = response?.trackingId || response?.data?.trackingId;
        const itemCount = response?.itemCount || 0;

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
    private interpretBatchStatus(response: any): InterpretedResponse {
        // YENİ: Batch tracking formatını kontrol et (processBatchResults'tan gelen)
        // Bu format: { status, summary: { total, success, failed }, successItems, failedItems }
        if (response?.summary && typeof response.summary === 'object') {
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
    private interpretBatchTrackingFormat(response: any): InterpretedResponse {
        const summary = response.summary || {};
        const status = response.status; // "COMPLETED", "PARTIAL", "FAILED"
        const successCount = summary.success || 0;
        const failureCount = summary.failed || 0;
        const totalCount = summary.total || (successCount + failureCount);

        // Status mapping
        let interpretedStatus: 'completed' | 'partial' | 'failed' | 'pending' = 'pending';
        if (status === 'COMPLETED') interpretedStatus = 'completed';
        else if (status === 'PARTIAL') interpretedStatus = 'partial';
        else if (status === 'FAILED') interpretedStatus = 'failed';

        // Özet mesaj
        let summaryMessage = '';
        if (interpretedStatus === 'completed') {
            summaryMessage = `Batch tamamlandı: ${successCount} ürün başarılı`;
        } else if (interpretedStatus === 'failed') {
            summaryMessage = `Batch başarısız: ${failureCount} ürün reddedildi`;
        } else if (interpretedStatus === 'partial') {
            summaryMessage = `Batch kısmen başarılı: ${successCount} başarılı, ${failureCount} başarısız`;
        } else {
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
                warningsCount: response.validationWarnings?.length || 0,
                successItems: response.successItems?.slice(0, 20) || [],
                failedItems: response.failedItems?.slice(0, 20) || [],
                itemsWithWarnings: response.validationWarnings?.slice(0, 20) || []
            },
            parsedAt: new Date()
        };
    }

    /**
     * Ticket API formatını yorumla (ürün upload sonuçları)
     * Format: { data: [{ merchantSku, importStatus, productStatus, validationResults }] }
     */
    private interpretTicketApiFormat(response: any): InterpretedResponse {
        // Hepsiburada data array olarak dönüyor
        const rawData = response?.data || response;
        const items = Array.isArray(rawData) ? rawData : (rawData?.data || []);

        const successItems = items.filter((item: any) => item.importStatus === 'SUCCESS');
        const failedItems = items.filter((item: any) => item.importStatus === 'FAILED');
        const itemsWithWarnings = successItems.filter((item: any) =>
            item.validationResults && item.validationResults.length > 0
        );

        const successCount = successItems.length;
        const failureCount = failedItems.length;
        const totalCount = items.length;

        // Status belirleme
        let status: 'completed' | 'partial' | 'failed' | 'pending' = 'pending';
        if (totalCount > 0) {
            if (failureCount === 0) status = 'completed';
            else if (successCount === 0) status = 'failed';
            else status = 'partial';
        }

        // Özet mesaj oluştur
        let summary = '';
        if (totalCount === 0) {
            summary = 'Batch durumu: Henüz sonuç yok';
        } else if (status === 'completed') {
            summary = `Batch tamamlandı: ${successCount} ürün başarılı`;
            if (itemsWithWarnings.length > 0) {
                summary += ` (${itemsWithWarnings.length} uyarı ile)`;
            }
        } else if (status === 'failed') {
            summary = `Batch başarısız: ${failureCount} ürün reddedildi`;
        } else {
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
                successItems: successItems.slice(0, 20).map((item: any) => ({
                    merchantSku: item.merchantSku,
                    barcode: item.barcode,
                    hbSku: item.hbSku,
                    productStatus: item.productStatus
                })),
                // Başarısız ürünler - detaylı hata bilgisi ile
                failedItems: failedItems.slice(0, 20).map((item: any) => ({
                    merchantSku: item.merchantSku,
                    barcode: item.barcode,
                    productStatus: item.productStatus,
                    errors: item.validationResults?.map((v: any) =>
                        `${v.attributeName}: ${v.message}`
                    ) || []
                })),
                // Uyarılı ürünler (SUCCESS ama validation warnings var)
                itemsWithWarnings: itemsWithWarnings.slice(0, 20).map((item: any) => ({
                    merchantSku: item.merchantSku,
                    productStatus: item.productStatus,
                    warnings: item.validationResults?.map((v: any) =>
                        `${v.attributeName}: ${v.message}`
                    ) || []
                }))
            },
            parsedAt: new Date()
        };
    }

    /**
     * Kategori listesi yanıtını yorumla
     * Hepsiburada response: { data: { categories: [...] } }
     */
    private interpretCategoryList(response: any): InterpretedResponse {
        const categories = response?.data?.categories || response?.categories || response?.data || [];
        const categoryCount = Array.isArray(categories) ? categories.length : 0;

        return {
            summary: `${categoryCount} kategori getirildi`,
            success: true,
            successCount: categoryCount,
            details: {
                categoryCount,
                hasSubCategories: categories.some((cat: any) =>
                    cat.subCategories && cat.subCategories.length > 0
                )
            },
            parsedAt: new Date()
        };
    }

    /**
     * Marka listesi yanıtını yorumla
     * Hepsiburada response: { data: { brands: [...] } }
     */
    private interpretBrandList(response: any): InterpretedResponse {
        const brands = response?.data?.brands || response?.brands || response?.data || [];
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
    private interpretCategoryAttributes(response: any): InterpretedResponse {
        const attributes = response?.data?.baseAttributes ||
                          response?.data?.attributes ||
                          response?.attributes ||
                          response?.data || [];
        const attributeCount = Array.isArray(attributes) ? attributes.length : 0;
        const requiredCount = attributes.filter((attr: any) => attr.mandatory || attr.required).length;

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
    private interpretStockAndPriceUpdate(response: any, operationType: OperationType): InterpretedResponse {
        // TrackingId varsa - asenkron işlem
        if (response?.trackingId) {
            const trackingId = response.trackingId;
            const itemCount = response?.itemCount || 0;

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
        if (response?.success === true || response?.status === 'SUCCESS') {
            const itemCount = response?.itemCount || response?.updatedCount || 1;

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
        if (response?.errors || response?.error || response?.success === false) {
            const errorMessage = response?.errors?.[0]?.message ||
                                response?.error?.message ||
                                response?.message ||
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
    private interpretProductSendUpdate(response: any): InterpretedResponse {
        // TrackingId varsa - asenkron batch işlemi
        if (response?.trackingId) {
            return this.interpretBatchRequest(response);
        }

        // Data array varsa - batch status gibi işle
        const rawData = response?.data || response;
        if (Array.isArray(rawData) && rawData.length > 0 && rawData[0]?.importStatus) {
            return this.interpretBatchStatus(response);
        }

        // Success response
        if (response?.success === true) {
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
        if (response?.success === false || response?.errors) {
            const errorMessage = response?.errors?.[0]?.message ||
                                response?.message ||
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
    private interpretGeneric(response: any, operationType: OperationType): InterpretedResponse {
        // Hepsiburada genel success kontrolü
        const isSuccess = response?.success !== false;

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
