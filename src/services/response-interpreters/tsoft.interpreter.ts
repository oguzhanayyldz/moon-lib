import { OperationType } from '../../enums/operation-type.enum';
import { InterpretedResponse } from '../../models/integrationRequestLog.schema';
import { BaseResponseInterpreter } from './base.interpreter';
import { logger } from '../logger.service';

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
export class TSoftResponseInterpreter extends BaseResponseInterpreter {
    interpret(response: any, operationType: OperationType): InterpretedResponse | null {
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
                case OperationType.FETCH_PRODUCTS:
                    return this.interpretProductList(response);

                case OperationType.SEND_PRODUCTS:
                case OperationType.UPDATE_PRODUCTS:
                    return this.interpretProductOperation(response, operationType);

                case OperationType.DELETE_PRODUCTS:
                    return this.interpretDeleteOperation(response, 'ürün');

                case OperationType.FETCH_ORDERS:
                    return this.interpretOrderList(response);

                case OperationType.UPDATE_ORDER:
                    return this.interpretOrderOperation(response);

                case OperationType.CANCEL_ORDER:
                    return this.interpretDeleteOperation(response, 'sipariş');

                case OperationType.UPDATE_STOCK:
                case OperationType.SYNC_STOCK:
                    return this.interpretStockUpdate(response);

                case OperationType.UPDATE_PRICES:
                case OperationType.FETCH_PRICES:
                    return this.interpretPriceOperation(response, operationType);

                case OperationType.SEND_TRACKING:
                case OperationType.DELIVER_ORDER:
                    return this.interpretShipmentUpdate(response);

                case OperationType.HEALTH_CHECK:
                    return this.interpretHealthCheck(response);

                default:
                    return this.interpretGeneric(response, operationType);
            }
        } catch (error) {
            logger.error('Error interpreting TSoft response', {
                operationType,
                error: (error as Error).message
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
    private interpretErrorResponse(response: any, operationType: OperationType): InterpretedResponse {
        let errorMessage: string;

        if (typeof response.error === 'string') {
            errorMessage = response.error;
        } else if (response.error?.message) {
            errorMessage = response.error.message;
        } else if (Array.isArray(response.errors)) {
            errorMessage = response.errors.map((e: any) => e?.message ?? e).join(', ');
        } else if (response.errors && typeof response.errors === 'object') {
            // Validation error: { field: [messages] }
            const messages: string[] = [];
            for (const [field, msgs] of Object.entries(response.errors)) {
                const flat = Array.isArray(msgs) ? msgs.join(', ') : String(msgs);
                messages.push(`${field}: ${flat}`);
            }
            errorMessage = messages.join('; ');
        } else if (response.message) {
            errorMessage = response.message;
        } else {
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
    private interpretProductList(response: any): InterpretedResponse {
        const products = Array.isArray(response?.data) ? response.data : (response?.data ? [response.data] : []);
        const totalCount = Number(response?.totalCount ?? products.length);

        return {
            summary: `${products.length} ürün getirildi${totalCount > products.length ? ` (toplam: ${totalCount})` : ''}`,
            success: true,
            successCount: products.length,
            details: {
                productCount: products.length,
                totalCount,
                offset: response?.offset,
                limit: response?.limit
            },
            parsedAt: new Date()
        };
    }

    /**
     * Ürün create/update işlemi yanıtını yorumla.
     * T-Soft single envelope: `{ data: TSoftProduct }`
     */
    private interpretProductOperation(response: any, operationType: OperationType): InterpretedResponse {
        const product = response?.data ?? response;
        const productId = product?.id;
        const productName = product?.name ?? product?.title;

        return {
            summary: `Ürün ${operationType === OperationType.SEND_PRODUCTS ? 'oluşturuldu' : 'güncellendi'}: ${productName || productId}`,
            success: true,
            successCount: 1,
            details: {
                productId,
                productName,
                wsProductCode: product?.wsProductCode,
                barcode: product?.barcode,
                stockCode: product?.stockCode,
                priceSale: product?.priceSale,
                stock: product?.stock
            },
            parsedAt: new Date()
        };
    }

    /**
     * Sipariş listesi yanıtını yorumla.
     * T-Soft envelope: `{ data: TSoftOrder[], totalCount, offset, limit }`
     */
    private interpretOrderList(response: any): InterpretedResponse {
        const orders = Array.isArray(response?.data) ? response.data : (response?.data ? [response.data] : []);
        const totalCount = Number(response?.totalCount ?? orders.length);

        return {
            summary: `${orders.length} sipariş getirildi${totalCount > orders.length ? ` (toplam: ${totalCount})` : ''}`,
            success: true,
            successCount: orders.length,
            details: {
                orderCount: orders.length,
                totalCount,
                offset: response?.offset,
                limit: response?.limit
            },
            parsedAt: new Date()
        };
    }

    /**
     * Sipariş update yanıtını yorumla.
     * T-Soft PUT /orders/order/{id} envelope: `{ data: TSoftOrder }`
     */
    private interpretOrderOperation(response: any): InterpretedResponse {
        const order = response?.data ?? response;
        const orderId = order?.id;
        const orderNumber = order?.orderNumber;

        return {
            summary: `Sipariş güncellendi: ${orderNumber || orderId}`,
            success: true,
            successCount: 1,
            details: {
                orderId,
                orderNumber,
                orderStatus: order?.orderStatus,
                cargoCompanyId: order?.cargoCompanyId,
                cargoCompanyName: order?.cargoCompanyName,
                waybillNumber: order?.waybillNumber,
                cargoNumber: order?.cargoNumber
            },
            parsedAt: new Date()
        };
    }

    /**
     * Stok güncelleme yanıtını yorumla.
     * T-Soft: PUT /catalog/products/{id} `{ stock | stock2 | stock99 }` -> `{ data: TSoftProduct }`
     */
    private interpretStockUpdate(response: any): InterpretedResponse {
        const product = response?.data ?? response;
        const productId = product?.id;
        const stock = product?.stock;
        const stock2 = product?.stock2;
        const stock99 = product?.stock99;

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
    private interpretPriceOperation(response: any, operationType: OperationType): InterpretedResponse {
        const items = Array.isArray(response?.data) ? response.data : null;

        if (items) {
            return {
                summary: `${items.length} fiyat bilgisi getirildi`,
                success: true,
                successCount: items.length,
                details: { count: items.length, totalCount: response?.totalCount },
                parsedAt: new Date()
            };
        }

        const product = response?.data ?? response;
        const productId = product?.id;

        return {
            summary: `Fiyat ${operationType === OperationType.FETCH_PRICES ? 'getirildi' : 'güncellendi'}: ürün ${productId}`,
            success: true,
            successCount: 1,
            details: {
                productId,
                priceSale: product?.priceSale,
                priceDiscount: product?.priceDiscount,
                purchasePrice: product?.purchasePrice
            },
            parsedAt: new Date()
        };
    }

    /**
     * Kargo bildirimi yanıtını yorumla.
     * T-Soft: PUT /orders/order/{id} `{ cargoCompanyId, waybillNumber, cargoNumber }` -> `{ data: TSoftOrder }`
     */
    private interpretShipmentUpdate(response: any): InterpretedResponse {
        const order = response?.data ?? response;
        const orderId = order?.id;
        const trackingCode = order?.waybillNumber || order?.cargoNumber;

        return {
            summary: `Kargo bildirimi başarılı${trackingCode ? `: ${trackingCode}` : ''}`,
            success: true,
            successCount: 1,
            details: {
                orderId,
                waybillNumber: order?.waybillNumber,
                cargoNumber: order?.cargoNumber,
                cargoCompanyId: order?.cargoCompanyId,
                cargoCompanyName: order?.cargoCompanyName,
                shipmentDate: order?.shipmentDate
            },
            parsedAt: new Date()
        };
    }

    /**
     * Silme/iptal işlemi yanıtını yorumla.
     * T-Soft DELETE /orders/order/{id} -> archive (soft delete), DELETE /catalog/products/{id} -> hard delete.
     */
    private interpretDeleteOperation(response: any, entityName: string): InterpretedResponse {
        const entity = response?.data ?? response;
        const id = entity?.id;

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
    private interpretHealthCheck(response: any): InterpretedResponse {
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
    private interpretGeneric(response: any, operationType: OperationType): InterpretedResponse {
        const items = Array.isArray(response?.data) ? response.data : null;
        if (items) {
            return {
                summary: `${operationType} işlemi tamamlandı (${items.length} kayıt)`,
                success: true,
                successCount: items.length,
                details: {
                    count: items.length,
                    totalCount: response?.totalCount
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
