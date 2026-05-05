import { OperationType } from '../../enums/operation-type.enum';
import { InterpretedResponse } from '../../models/integrationRequestLog.schema';
import { BaseResponseInterpreter } from './base.interpreter';
import { logger } from '../logger.service';

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
export class CicekSepetiResponseInterpreter extends BaseResponseInterpreter {
    interpret(response: any, operationType: OperationType): InterpretedResponse | null {
        if (this.isEmptyResponse(response)) {
            return null;
        }

        try {
            switch (operationType) {
                case OperationType.SEND_PRODUCTS:
                case OperationType.UPDATE_PRODUCTS:
                case OperationType.UPDATE_STOCK:
                case OperationType.UPDATE_PRICES:
                case OperationType.UPDATE_STOCK_AND_PRICE:
                    return this.interpretBatchSubmit(response, operationType);

                case OperationType.GET_BATCH_STATUS:
                    return this.interpretBatchStatus(response);

                case OperationType.FETCH_PRODUCTS:
                    return this.interpretProductList(response);

                case OperationType.FETCH_ORDERS:
                    return this.interpretOrderOrRefundList(response);

                case OperationType.UPDATE_ORDER:
                    return this.interpretOrderUpdate(response);

                case OperationType.GET_CATEGORIES:
                    return this.interpretCategoryList(response);

                case OperationType.GET_CATEGORY_ATTRIBUTES:
                    return this.interpretCategoryAttributes(response);

                case OperationType.READ:
                    return this.interpretRead(response, operationType);

                default:
                    return this.interpretGeneric(response, operationType);
            }
        } catch (error) {
            logger.error('Error interpreting CicekSepeti response', {
                operationType,
                error: (error as Error).message
            });
            return null;
        }
    }

    /**
     * Batch submit yanıtını yorumla — POST /Products, PUT /Products, PUT /Products/price-and-stock
     * Response: { batchId: "uuid-..." }
     */
    private interpretBatchSubmit(response: any, operationType: OperationType): InterpretedResponse {
        const batchId = response?.batchId;

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
        if (response?.code || response?.message) {
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
    private interpretBatchStatus(response: any): InterpretedResponse {
        const items = Array.isArray(response?.items) ? response.items : [];
        const successCount = items.filter((item: any) => item.status === 'Success').length;
        const failureCount = items.filter((item: any) => item.status === 'Failed').length;
        const warningCount = items.filter((item: any) => item.status === 'Warning').length;
        const pendingCount = items.filter(
            (item: any) => item.status === 'Pending' || item.status === 'Processing'
        ).length;

        let summary = '';
        if (pendingCount > 0) {
            summary = `Batch durumu: ${successCount} başarılı, ${failureCount} başarısız, ${warningCount} uyarılı, ${pendingCount} beklemede`;
        } else {
            summary = `Batch tamamlandı: ${successCount} başarılı, ${failureCount} başarısız, ${warningCount} uyarılı`;
        }

        return {
            summary,
            success: failureCount === 0,
            successCount,
            failureCount,
            details: {
                batchId: response?.batchId,
                total: response?.itemCount ?? items.length,
                pending: pendingCount,
                warning: warningCount,
                failures: items
                    .filter((item: any) => item.status === 'Failed')
                    .map((item: any) => ({
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
    private interpretProductList(response: any): InterpretedResponse {
        const products = Array.isArray(response?.products) ? response.products : [];
        const totalCount = response?.totalCount ?? products.length;

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
    private interpretOrderOrRefundList(response: any): InterpretedResponse {
        // Sipariş listesi
        if (Array.isArray(response?.supplierOrderListWithBranch)) {
            const items = response.supplierOrderListWithBranch;
            const totalCount = response.orderListCount ?? items.length;
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
        if (Array.isArray(response?.orderItemList)) {
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

        return this.interpretGeneric(response, OperationType.FETCH_ORDERS);
    }

    /**
     * Sipariş güncelleme yanıtını yorumla
     * Order/cancelevaluation → { isSuccess, message }
     * Order/refundprocessstartreceivedprocess → { orderItems: [{orderItemId, isSuccess, validation}] }
     */
    private interpretOrderUpdate(response: any): InterpretedResponse {
        // cancelevaluation single-result
        if (typeof response?.isSuccess === 'boolean' && !Array.isArray(response?.orderItems)) {
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
        if (Array.isArray(response?.orderItems)) {
            const items = response.orderItems;
            const successCount = items.filter((x: any) => x.isSuccess === true).length;
            const failureCount = items.filter((x: any) => x.isSuccess === false).length;

            return {
                summary: `${successCount} item başarılı, ${failureCount} başarısız`,
                success: failureCount === 0,
                successCount,
                failureCount,
                details: {
                    items: items.map((x: any) => ({
                        orderItemId: x.orderItemId,
                        isSuccess: x.isSuccess,
                        validation: x.validation
                    }))
                },
                parsedAt: new Date()
            };
        }

        return this.interpretGeneric(response, OperationType.UPDATE_ORDER);
    }

    /**
     * Kategori listesi yanıtını yorumla (tree yapısı)
     * Response: { categories: [{id, name, parentCategoryId, subCategories: [...]}] }
     */
    private interpretCategoryList(response: any): InterpretedResponse {
        const categories = Array.isArray(response?.categories) ? response.categories : [];

        // Recursive flat count
        const countNodes = (nodes: any[]): number => {
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
    private interpretCategoryAttributes(response: any): InterpretedResponse {
        const attributes = Array.isArray(response?.categoryAttributes) ? response.categoryAttributes : [];
        const requiredCount = attributes.filter((a: any) => a.required === true).length;
        const variantCount = attributes.filter((a: any) => a.varianter === true).length;

        return {
            summary: `Kategori için ${attributes.length} özellik getirildi (${requiredCount} zorunlu, ${variantCount} varyant)`,
            success: true,
            successCount: attributes.length,
            details: {
                categoryId: response?.categoryId,
                categoryName: response?.categoryName,
                attributeCount: attributes.length,
                requiredCount,
                variantCount
            },
            parsedAt: new Date()
        };
    }

    /**
     * READ operation — birden fazla endpoint kullanıyor (sellerquestions, actions vb.)
     * Response yapısına göre discriminate edilir.
     */
    private interpretRead(response: any, operationType: OperationType): InterpretedResponse {
        // /sellerquestions GET → { items: [...], hasNextPage: boolean }
        if (Array.isArray(response?.items) && typeof response?.hasNextPage === 'boolean') {
            return this.interpretQuestionList(response);
        }
        // /sellerquestions/actions GET → { actions: [...] } veya array
        if (Array.isArray(response?.actions) || Array.isArray(response)) {
            return this.interpretActionsList(response);
        }
        return this.interpretGeneric(response, operationType);
    }

    /**
     * Soru listesi yanıtını yorumla
     * Response: { items: [{id, product, question, answer, answered, ...}], hasNextPage: boolean }
     * Kaynak: docs/integrations/ciceksepeti/pages/019-ürün-sorularını-çekme.md
     */
    private interpretQuestionList(response: any): InterpretedResponse {
        const items = Array.isArray(response?.items) ? response.items : [];
        const answeredCount = items.filter((q: any) => q.answered === true).length;
        const unansweredCount = items.filter((q: any) => q.answered === false).length;
        const hasNextPage = response?.hasNextPage === true;

        return {
            summary: `${items.length} ürün sorusu getirildi (${answeredCount} cevaplanmış, ${unansweredCount} cevaplanmamış)${hasNextPage ? ' — sonraki sayfa var' : ''}`,
            success: true,
            successCount: items.length,
            details: {
                pageItemCount: items.length,
                answeredCount,
                unansweredCount,
                hasNextPage
            },
            parsedAt: new Date()
        };
    }

    /**
     * BranchAction listesi yanıtını yorumla
     * Response: { actions: [{name, value, details: [...]}] } veya direkt array
     * Kaynak: docs/integrations/ciceksepeti/pages/020-ürün-sorularını-cevaplama.md
     */
    private interpretActionsList(response: any): InterpretedResponse {
        const actions = Array.isArray(response?.actions)
            ? response.actions
            : (Array.isArray(response) ? response : []);

        return {
            summary: `${actions.length} branch action getirildi`,
            success: true,
            successCount: actions.length,
            details: {
                actionCount: actions.length
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
                operationType,
                responseType: typeof response,
                hasData: !this.isEmptyResponse(response)
            },
            parsedAt: new Date()
        };
    }
}
