import { OperationType } from '../../enums/operation-type.enum';
import { InterpretedResponse } from '../../models/integrationRequestLog.schema';
import { BaseResponseInterpreter } from './base.interpreter';
import { logger } from '../logger.service';

/**
 * WooCommerce REST API yanıtlarını yorumlayan interpreter
 * WP REST API v3 (/wp-json/wc/v3) format'ı
 */
export class WooCommerceResponseInterpreter extends BaseResponseInterpreter {
    interpret(response: any, operationType: OperationType): InterpretedResponse | null {
        if (this.isEmptyResponse(response)) {
            return null;
        }

        try {
            // WP REST API hata formatı: {code, message, data: {status}}
            if (response?.code && response?.message && response?.data?.status) {
                return this.interpretWcError(response);
            }

            switch (operationType) {
                case OperationType.SEND_PRODUCTS:
                case OperationType.UPDATE_PRODUCTS:
                    return this.interpretProductOperation(response);

                case OperationType.FETCH_PRODUCTS:
                    return this.interpretProductList(response);

                case OperationType.CREATE_ORDER:
                case OperationType.UPDATE_ORDER:
                    return this.interpretOrderOperation(response);

                case OperationType.FETCH_ORDERS:
                    return this.interpretOrderList(response);

                case OperationType.UPDATE_STOCK:
                    return this.interpretStockUpdate(response);

                default:
                    return this.interpretGeneric(response, operationType);
            }
        } catch (error) {
            logger.error('Error interpreting WooCommerce response', {
                operationType,
                error: (error as Error).message
            });
            return null;
        }
    }

    private interpretWcError(response: any): InterpretedResponse {
        return {
            summary: `WooCommerce API hatası (${response.data.status}): ${response.message}`,
            success: false,
            failureCount: 1,
            details: {
                code: response.code,
                status: response.data.status,
                additionalData: response.data
            },
            parsedAt: new Date()
        };
    }

    /**
     * Ürün create/update yanıtı (tek nesne döner)
     */
    private interpretProductOperation(response: any): InterpretedResponse {
        const productId = response?.id;
        const name = response?.name;
        const sku = response?.sku;
        const type = response?.type;
        const variationCount = Array.isArray(response?.variations) ? response.variations.length : 0;

        return {
            summary: `Ürün işlemi başarılı: ${name || sku || productId}${type === 'variable' ? ` (${variationCount} varyant)` : ''}`,
            success: true,
            successCount: 1,
            details: {
                productId,
                name,
                sku,
                type,
                status: response?.status,
                stockStatus: response?.stock_status,
                stockQuantity: response?.stock_quantity,
                variationCount
            },
            parsedAt: new Date()
        };
    }

    /**
     * Ürün list yanıtı (array doğrudan döner — `products` wrapper YOK)
     */
    private interpretProductList(response: any): InterpretedResponse {
        const products = Array.isArray(response) ? response : [];
        const productCount = products.length;

        return {
            summary: `${productCount} ürün getirildi`,
            success: true,
            successCount: productCount,
            details: {
                productCount,
                firstId: products[0]?.id,
                lastId: products[productCount - 1]?.id
            },
            parsedAt: new Date()
        };
    }

    /**
     * Sipariş create/update yanıtı (tek nesne döner)
     */
    private interpretOrderOperation(response: any): InterpretedResponse {
        const orderId = response?.id;
        const orderNumber = response?.number;
        const total = response?.total;
        const currency = response?.currency;

        return {
            summary: `Sipariş işlemi başarılı: #${orderNumber || orderId} (${total} ${currency})`,
            success: true,
            successCount: 1,
            details: {
                orderId,
                orderNumber,
                total,
                currency,
                status: response?.status,
                paymentMethod: response?.payment_method
            },
            parsedAt: new Date()
        };
    }

    /**
     * Sipariş list yanıtı (array doğrudan döner)
     */
    private interpretOrderList(response: any): InterpretedResponse {
        const orders = Array.isArray(response) ? response : [];
        const orderCount = orders.length;

        return {
            summary: `${orderCount} sipariş getirildi`,
            success: true,
            successCount: orderCount,
            details: {
                orderCount,
                firstId: orders[0]?.id,
                lastId: orders[orderCount - 1]?.id
            },
            parsedAt: new Date()
        };
    }

    /**
     * Stok güncelleme yanıtı (product update'in alt kümesi: stock_quantity + stock_status)
     */
    private interpretStockUpdate(response: any): InterpretedResponse {
        const productId = response?.id;
        const stockQuantity = response?.stock_quantity;
        const stockStatus = response?.stock_status;
        const manageStock = response?.manage_stock;

        return {
            summary: `Stok güncellendi: ${stockQuantity ?? 'N/A'} adet (${stockStatus || 'unknown'})`,
            success: true,
            successCount: 1,
            details: {
                productId,
                stockQuantity,
                stockStatus,
                manageStock
            },
            parsedAt: new Date()
        };
    }

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
