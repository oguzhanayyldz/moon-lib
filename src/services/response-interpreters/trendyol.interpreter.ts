import { OperationType } from '../../enums/operation-type.enum';
import { InterpretedResponse } from '../../models/integrationRequestLog.schema';
import { BaseResponseInterpreter } from './base.interpreter';
import { logger } from '../logger.service';

/**
 * Trendyol API yanıtlarını yorumlayan interpreter
 */
export class TrendyolResponseInterpreter extends BaseResponseInterpreter {
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
            logger.error('Error interpreting Trendyol response', {
                operationType,
                error: (error as Error).message
            });
            return null;
        }
    }

    /**
     * Batch request yanıtını yorumla
     * Örnek response: { batchRequestId: "xxx", itemCount: 15 }
     */
    private interpretBatchRequest(response: any): InterpretedResponse {
        const batchRequestId = response?.batchRequestId;
        const itemCount = response?.itemCount || 0;

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
    private interpretBatchStatus(response: any): InterpretedResponse {
        const items = response?.items || [];
        const successCount = items.filter((item: any) => item.status === 'SUCCESS').length;
        const failureCount = items.filter((item: any) => item.status === 'FAILED' || item.status === 'ERROR').length;
        const pendingCount = items.filter((item: any) => item.status === 'PENDING' || item.status === 'IN_PROGRESS').length;

        let summary = '';
        if (pendingCount > 0) {
            summary = `Batch durumu: ${successCount} başarılı, ${failureCount} başarısız, ${pendingCount} beklemede`;
        } else {
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
                items: items.map((item: any) => ({
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
    private interpretCategoryList(response: any): InterpretedResponse {
        const categories = response?.categories || response || [];
        const categoryCount = Array.isArray(categories) ? categories.length : 0;

        return {
            summary: `${categoryCount} kategori getirildi`,
            success: true,
            successCount: categoryCount,
            details: {
                categoryCount,
                hasSubCategories: categories.some((cat: any) => cat.subCategories && cat.subCategories.length > 0)
            },
            parsedAt: new Date()
        };
    }

    /**
     * Marka listesi yanıtını yorumla
     */
    private interpretBrandList(response: any): InterpretedResponse {
        const brands = response?.brands || response || [];
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
    private interpretCategoryAttributes(response: any): InterpretedResponse {
        const attributes = response?.categoryAttributes || response?.attributes || response || [];
        const attributeCount = Array.isArray(attributes) ? attributes.length : 0;

        return {
            summary: `Kategori için ${attributeCount} özellik getirildi`,
            success: true,
            successCount: attributeCount,
            details: {
                attributeCount,
                requiredCount: attributes.filter((attr: any) => attr.required).length
            },
            parsedAt: new Date()
        };
    }

    /**
     * Stok ve/veya fiyat güncelleme yanıtını yorumla
     * Trendyol stok/fiyat güncelleme endpoint'i batchRequestId döndürebilir
     */
    private interpretStockAndPriceUpdate(response: any, operationType: OperationType): InterpretedResponse {
        // BatchRequestId varsa - asenkron işlem
        if (response?.batchRequestId) {
            const batchRequestId = response.batchRequestId;
            const itemCount = response?.itemCount || response?.items?.length || 0;

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
        if (response?.status === 'SUCCESS' || response?.success === true) {
            const itemCount = response?.itemCount || response?.updatedCount || 1;

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
        if (response?.errors || response?.error) {
            const errorMessage = response?.errors?.[0]?.message || response?.error?.message || 'Bilinmeyen hata';

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
    private interpretProductSendUpdate(response: any): InterpretedResponse {
        // BatchRequestId varsa
        if (response?.batchRequestId) {
            const batchRequestId = response.batchRequestId;
            const itemCount = response?.itemCount || 0;

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
        if (response?.items && Array.isArray(response.items)) {
            const successCount = response.items.filter((item: any) => item.status === 'SUCCESS').length;
            const failureCount = response.items.filter((item: any) => item.status === 'FAILED' || item.status === 'ERROR').length;
            const failedItems = response.items.filter((item: any) =>
                (item.status === 'FAILED' || item.status === 'ERROR') && item.failureReasons
            );

            let summary = `${successCount} başarılı, ${failureCount} başarısız`;

            return {
                summary,
                success: failureCount === 0,
                successCount,
                failureCount,
                details: {
                    total: response.items.length,
                    items: failedItems.map((item: any) => ({
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
    private interpretGeneric(response: any, operationType: OperationType): InterpretedResponse {
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
