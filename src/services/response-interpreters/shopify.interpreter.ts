import { OperationType } from '../../enums/operation-type.enum';
import { InterpretedResponse } from '../../models/integrationRequestLog.schema';
import { BaseResponseInterpreter } from './base.interpreter';
import { logger } from '../logger.service';

/**
 * Shopify API yanıtlarını yorumlayan interpreter
 */
export class ShopifyResponseInterpreter extends BaseResponseInterpreter {
    interpret(response: any, operationType: OperationType): InterpretedResponse | null {
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
                    return this.interpretInventoryUpdate(response);

                default:
                    return this.interpretGeneric(response, operationType);
            }
        } catch (error) {
            logger.error('Error interpreting Shopify response', {
                operationType,
                error: (error as Error).message
            });
            return null;
        }
    }

    /**
     * GraphQL yanıtını yorumla
     */
    private interpretGraphQLResponse(response: any, operationType: OperationType): InterpretedResponse {
        const hasErrors = response.errors && response.errors.length > 0;
        const hasData = response.data && Object.keys(response.data).length > 0;

        if (hasErrors) {
            const errorMessages = response.errors.map((err: any) => err.message).join(', ');
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
                    userErrors: operation?.userErrors || [],
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
    private interpretProductOperation(response: any): InterpretedResponse {
        const product = response?.product;
        const productId = product?.id;
        const title = product?.title;
        const variantCount = product?.variants?.length || 0;

        return {
            summary: `Ürün işlemi başarılı: ${title || productId} (${variantCount} varyant)`,
            success: true,
            successCount: 1,
            details: {
                productId,
                title,
                variantCount,
                status: product?.status
            },
            parsedAt: new Date()
        };
    }

    /**
     * Ürün listesi yanıtını yorumla
     */
    private interpretProductList(response: any): InterpretedResponse {
        const products = response?.products || [];
        const productCount = products.length;

        return {
            summary: `${productCount} ürün getirildi`,
            success: true,
            successCount: productCount,
            details: {
                productCount,
                hasNextPage: !!response?.pageInfo?.hasNextPage
            },
            parsedAt: new Date()
        };
    }

    /**
     * Sipariş işlemi (create/update) yanıtını yorumla
     */
    private interpretOrderOperation(response: any): InterpretedResponse {
        const order = response?.order;
        const orderId = order?.id;
        const orderNumber = order?.order_number || order?.name;
        const totalPrice = order?.total_price;

        return {
            summary: `Sipariş işlemi başarılı: ${orderNumber || orderId} (${totalPrice})`,
            success: true,
            successCount: 1,
            details: {
                orderId,
                orderNumber,
                totalPrice,
                status: order?.financial_status,
                fulfillmentStatus: order?.fulfillment_status
            },
            parsedAt: new Date()
        };
    }

    /**
     * Sipariş listesi yanıtını yorumla
     */
    private interpretOrderList(response: any): InterpretedResponse {
        const orders = response?.orders || [];
        const orderCount = orders.length;

        return {
            summary: `${orderCount} sipariş getirildi`,
            success: true,
            successCount: orderCount,
            details: {
                orderCount,
                hasNextPage: !!response?.pageInfo?.hasNextPage
            },
            parsedAt: new Date()
        };
    }

    /**
     * Stok güncelleme yanıtını yorumla
     */
    private interpretInventoryUpdate(response: any): InterpretedResponse {
        const inventoryLevel = response?.inventory_level;
        const available = inventoryLevel?.available;

        return {
            summary: `Stok güncellendi: ${available} adet mevcut`,
            success: true,
            successCount: 1,
            details: {
                available,
                inventoryItemId: inventoryLevel?.inventory_item_id,
                locationId: inventoryLevel?.location_id
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
