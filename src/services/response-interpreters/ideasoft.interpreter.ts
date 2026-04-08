import { OperationType } from '../../enums/operation-type.enum';
import { InterpretedResponse } from '../../models/integrationRequestLog.schema';
import { BaseResponseInterpreter } from './base.interpreter';
import { logger } from '../logger.service';

/**
 * IdeaSoft Admin API (REST) yanıtlarını yorumlayan interpreter
 * IdeaSoft tüm işlemlerini REST endpoint'leri üzerinden yapar
 */
export class IdeaSoftResponseInterpreter extends BaseResponseInterpreter {
    interpret(response: any, operationType: OperationType): InterpretedResponse | null {
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
                case OperationType.FETCH_PRODUCTS:
                    return this.interpretProductList(response);

                case OperationType.SEND_PRODUCTS:
                case OperationType.UPDATE_PRODUCTS:
                    return this.interpretProductOperation(response, operationType);

                case OperationType.FETCH_ORDERS:
                    return this.interpretOrderList(response);

                case OperationType.CREATE_ORDER:
                case OperationType.UPDATE_ORDER:
                    return this.interpretOrderOperation(response, operationType);

                case OperationType.UPDATE_STOCK:
                case OperationType.SYNC_STOCK:
                    return this.interpretStockUpdate(response);

                case OperationType.UPDATE_PRICES:
                case OperationType.FETCH_PRICES:
                    return this.interpretPriceOperation(response, operationType);

                case OperationType.GET_BRANDS:
                    return this.interpretBrandList(response);

                case OperationType.GET_CATEGORIES:
                    return this.interpretCategoryList(response);

                case OperationType.SEND_TRACKING:
                case OperationType.DELIVER_ORDER:
                    return this.interpretShipmentUpdate(response);

                case OperationType.FETCH_CLAIMS:
                case OperationType.ACCEPT_CLAIM:
                case OperationType.REJECT_CLAIM:
                    return this.interpretRefundOperation(response, operationType);

                default:
                    return this.interpretGeneric(response, operationType);
            }
        } catch (error) {
            logger.error('Error interpreting IdeaSoft response', {
                operationType,
                error: (error as Error).message
            });
            return null;
        }
    }

    /**
     * Hata yanıtını yorumla
     */
    private interpretErrorResponse(response: any, operationType: OperationType): InterpretedResponse {
        const errorMessage = response.error?.message
            || (Array.isArray(response.errors) ? response.errors.map((e: any) => e.message).join(', ') : response.errors)
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
    private interpretListResponse(response: any[], operationType: OperationType): InterpretedResponse {
        const entityName = operationType === OperationType.FETCH_PRODUCTS ? 'ürün'
            : operationType === OperationType.FETCH_ORDERS ? 'sipariş'
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
    private interpretProductList(response: any): InterpretedResponse {
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
    private interpretProductOperation(response: any, operationType: OperationType): InterpretedResponse {
        const productId = response?.id;
        const productName = response?.name;

        return {
            summary: `Ürün ${operationType === OperationType.SEND_PRODUCTS ? 'oluşturuldu' : 'güncellendi'}: ${productName || productId}`,
            success: true,
            successCount: 1,
            details: {
                productId,
                productName,
                sku: response?.sku,
                stockCount: response?.stockCount
            },
            parsedAt: new Date()
        };
    }

    /**
     * Sipariş listesi yanıtını yorumla
     */
    private interpretOrderList(response: any): InterpretedResponse {
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
    private interpretOrderOperation(response: any, operationType: OperationType): InterpretedResponse {
        const orderId = response?.id;
        const orderNumber = response?.orderNumber;

        return {
            summary: `Sipariş ${operationType === OperationType.CREATE_ORDER ? 'oluşturuldu' : 'güncellendi'}: ${orderNumber || orderId}`,
            success: true,
            successCount: 1,
            details: {
                orderId,
                orderNumber,
                status: response?.status
            },
            parsedAt: new Date()
        };
    }

    /**
     * Stok güncelleme yanıtını yorumla
     */
    private interpretStockUpdate(response: any): InterpretedResponse {
        const productId = response?.id;
        const stockCount = response?.stockCount;

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
    private interpretPriceOperation(response: any, operationType: OperationType): InterpretedResponse {
        if (Array.isArray(response)) {
            return {
                summary: `${response.length} fiyat bilgisi getirildi`,
                success: true,
                successCount: response.length,
                details: { count: response.length },
                parsedAt: new Date()
            };
        }

        const productId = response?.product?.id || response?.id;
        return {
            summary: `Fiyat ${operationType === OperationType.FETCH_PRICES ? 'getirildi' : 'güncellendi'}: ürün ${productId}`,
            success: true,
            successCount: 1,
            details: {
                productId,
                price1: response?.price1,
                discount: response?.discount
            },
            parsedAt: new Date()
        };
    }

    /**
     * Marka listesi yanıtını yorumla (GET /brands)
     */
    private interpretBrandList(response: any): InterpretedResponse {
        const brands = Array.isArray(response) ? response : [response];
        return {
            summary: `${brands.length} marka getirildi`,
            success: true,
            successCount: brands.length,
            details: {
                brandCount: brands.length,
                brands: brands.slice(0, 5).map((b: any) => ({ id: b.id, name: b.name }))
            },
            parsedAt: new Date()
        };
    }

    /**
     * Kategori listesi yanıtını yorumla (GET /categories)
     */
    private interpretCategoryList(response: any): InterpretedResponse {
        const categories = Array.isArray(response) ? response : [response];
        return {
            summary: `${categories.length} kategori getirildi`,
            success: true,
            successCount: categories.length,
            details: {
                categoryCount: categories.length,
                categories: categories.slice(0, 5).map((c: any) => ({ id: c.id, name: c.name }))
            },
            parsedAt: new Date()
        };
    }

    /**
     * Kargo/shipment güncelleme yanıtını yorumla
     * IdeaSoft: Shipment CreateAction PUT, shippingTrackingCode field
     */
    private interpretShipmentUpdate(response: any): InterpretedResponse {
        const shipmentId = response?.id;
        const trackingCode = response?.shippingTrackingCode || response?.barcode;

        return {
            summary: `Kargo bildirimi başarılı${trackingCode ? `: ${trackingCode}` : ''}`,
            success: true,
            successCount: 1,
            details: {
                shipmentId,
                trackingCode,
                shippingCompanyName: response?.shippingCompanyName,
                status: response?.status
            },
            parsedAt: new Date()
        };
    }

    /**
     * İade işlemi yanıtını yorumla (GET/POST /order_refund_requests)
     */
    private interpretRefundOperation(response: any, operationType: OperationType): InterpretedResponse {
        if (Array.isArray(response)) {
            return {
                summary: `${response.length} iade talebi getirildi`,
                success: true,
                successCount: response.length,
                details: {
                    refundCount: response.length,
                    statuses: response.slice(0, 10).map((r: any) => ({ id: r.id, status: r.status }))
                },
                parsedAt: new Date()
            };
        }

        const refundId = response?.id;
        const status = response?.status;
        const actionLabel = operationType === OperationType.ACCEPT_CLAIM ? 'onaylandı'
            : operationType === OperationType.REJECT_CLAIM ? 'reddedildi'
            : 'işlendi';

        return {
            summary: `İade talebi ${actionLabel}: #${refundId}${status ? ` (${status})` : ''}`,
            success: true,
            successCount: 1,
            details: {
                refundId,
                status,
                fee: response?.fee,
                shippingFee: response?.shippingFee
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
