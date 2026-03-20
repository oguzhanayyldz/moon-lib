import { OperationType } from '../../enums/operation-type.enum';
import { InterpretedResponse } from '../../models/integrationRequestLog.schema';
import { BaseResponseInterpreter } from './base.interpreter';
import { logger } from '../logger.service';

/**
 * ikas GraphQL API yanıtlarını yorumlayan interpreter
 * ikas tüm işlemlerini GraphQL üzerinden yapar (REST sadece image upload için)
 */
export class IkasResponseInterpreter extends BaseResponseInterpreter {
    interpret(response: any, operationType: OperationType): InterpretedResponse | null {
        if (this.isEmptyResponse(response)) {
            return null;
        }

        try {
            // GraphQL response kontrolü (ikas tüm API'yi GraphQL ile kullanır)
            if (response.errors || response.data) {
                return this.interpretGraphQLResponse(response, operationType);
            }

            // Pagination response (listProduct, listOrder)
            if (response.count !== undefined && response.data && Array.isArray(response.data)) {
                return this.interpretPaginationResponse(response, operationType);
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

                case OperationType.SEND_TRACKING:
                    return this.interpretFulfillment(response);

                default:
                    return this.interpretGeneric(response, operationType);
            }
        } catch (error) {
            logger.error('Error interpreting ikas response', {
                operationType,
                error: (error as Error).message
            });
            return null;
        }
    }

    /**
     * GraphQL yanıtını yorumla (ikas'ın ana response formatı)
     */
    private interpretGraphQLResponse(response: any, operationType: OperationType): InterpretedResponse {
        const hasErrors = response.errors && response.errors.length > 0;

        if (hasErrors) {
            const errorMessages = response.errors.map((err: any) => err.message).join(', ');
            return {
                summary: `GraphQL ${operationType} başarısız: ${errorMessages}`,
                success: false,
                failureCount: response.errors.length,
                details: {
                    errors: response.errors,
                    extensions: response.extensions
                },
                parsedAt: new Date()
            };
        }

        // Data içindeki ilk key'i bul (listProduct, fulfillOrder, etc.)
        const data = response.data || response;
        const firstKey = typeof data === 'object' ? Object.keys(data)[0] : null;
        const operationData = firstKey ? data[firstKey] : data;

        // Pagination response check (listProduct, listOrder)
        if (operationData && operationData.count !== undefined && Array.isArray(operationData.data)) {
            return this.interpretPaginationResponse(operationData, operationType);
        }

        return {
            summary: `GraphQL ${operationType} başarılı`,
            success: true,
            successCount: 1,
            details: {
                operation: firstKey,
                resultType: typeof operationData
            },
            parsedAt: new Date()
        };
    }

    /**
     * Pagination yanıtını yorumla (listProduct, listOrder)
     */
    private interpretPaginationResponse(response: any, operationType: OperationType): InterpretedResponse {
        const count = response.count || 0;
        const dataLength = response.data?.length || 0;
        const hasNext = response.hasNext || false;
        const page = response.page || 1;

        const entityName = operationType === OperationType.FETCH_PRODUCTS ? 'ürün'
            : operationType === OperationType.FETCH_ORDERS ? 'sipariş'
            : 'kayıt';

        return {
            summary: `${dataLength} ${entityName} getirildi (toplam: ${count}, sayfa: ${page})`,
            success: true,
            successCount: dataLength,
            details: {
                totalCount: count,
                pageCount: dataLength,
                page,
                hasNext
            },
            parsedAt: new Date()
        };
    }

    /**
     * Ürün listesi yanıtını yorumla
     */
    private interpretProductList(response: any): InterpretedResponse {
        // listProduct response
        const listProduct = response.listProduct || response;
        const products = listProduct.data || [];
        const productCount = products.length;

        return {
            summary: `${productCount} ürün getirildi`,
            success: true,
            successCount: productCount,
            details: {
                productCount,
                totalCount: listProduct.count,
                hasNextPage: listProduct.hasNext
            },
            parsedAt: new Date()
        };
    }

    /**
     * Ürün create/update işlemi yanıtını yorumla
     */
    private interpretProductOperation(response: any, operationType: OperationType): InterpretedResponse {
        const product = response.createProduct || response.updateProduct || response;
        const productId = product?.id;
        const productName = product?.name;

        return {
            summary: `Ürün ${operationType === OperationType.SEND_PRODUCTS ? 'oluşturuldu' : 'güncellendi'}: ${productName || productId}`,
            success: true,
            successCount: 1,
            details: {
                productId,
                productName
            },
            parsedAt: new Date()
        };
    }

    /**
     * Sipariş listesi yanıtını yorumla
     */
    private interpretOrderList(response: any): InterpretedResponse {
        const listOrder = response.listOrder || response;
        const orders = listOrder.data || [];
        const orderCount = orders.length;

        return {
            summary: `${orderCount} sipariş getirildi`,
            success: true,
            successCount: orderCount,
            details: {
                orderCount,
                totalCount: listOrder.count,
                hasNextPage: listOrder.hasNext
            },
            parsedAt: new Date()
        };
    }

    /**
     * Sipariş create/update işlemi yanıtını yorumla
     */
    private interpretOrderOperation(response: any, operationType: OperationType): InterpretedResponse {
        const order = response.fulfillOrder || response.updateOrderPackageStatus || response;
        const orderId = order?.id;
        const orderNumber = order?.orderNumber;
        const packageCount = order?.orderPackages?.length || 0;

        return {
            summary: `Sipariş ${operationType === OperationType.CREATE_ORDER ? 'karşılandı' : 'güncellendi'}: ${orderNumber || orderId} (${packageCount} paket)`,
            success: true,
            successCount: 1,
            details: {
                orderId,
                orderNumber,
                packageCount
            },
            parsedAt: new Date()
        };
    }

    /**
     * Stok güncelleme yanıtını yorumla (saveVariantStocks)
     */
    private interpretStockUpdate(response: any): InterpretedResponse {
        const result = response.saveVariantStocks;
        const success = result === true || !!result;

        return {
            summary: success ? 'Stok güncelleme başarılı' : 'Stok güncelleme başarısız',
            success,
            successCount: success ? 1 : 0,
            failureCount: success ? 0 : 1,
            parsedAt: new Date()
        };
    }

    /**
     * Fulfillment (kargo gönderim) yanıtını yorumla
     */
    private interpretFulfillment(response: any): InterpretedResponse {
        const fulfillment = response.fulfillOrder || response;
        const orderId = fulfillment?.id;
        const orderNumber = fulfillment?.orderNumber;
        const packageCount = fulfillment?.orderPackages?.length || 0;

        return {
            summary: `Kargo bildirimi başarılı: ${orderNumber || orderId} (${packageCount} paket)`,
            success: true,
            successCount: 1,
            details: {
                orderId,
                orderNumber,
                packageCount
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
