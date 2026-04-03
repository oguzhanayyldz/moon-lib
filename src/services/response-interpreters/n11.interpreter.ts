import { OperationType } from '../../enums/operation-type.enum';
import { InterpretedResponse } from '../../models/integrationRequestLog.schema';
import { BaseResponseInterpreter } from './base.interpreter';
import { logger } from '../logger.service';

/**
 * N11 API yanıtlarını yorumlayan interpreter
 *
 * N11 API response pattern'leri:
 * - Ürün işlemleri: { id (taskId), type, status: "IN_QUEUE"|"REJECT", reasons }
 * - Task sorgulama: { taskId, skus: { content: [...] }, status: "PROCESSED"|"IN_QUEUE" }
 * - Ürün sorgulama: { content: [...], totalElements, totalPages }
 * - Sipariş listeleme: { content: [...], totalPages, page, size }
 * - Sipariş güncelleme: { content: [{ lineId, status, reasons }] }
 * - Kategori: Array (ağaç yapısı, subCategories)
 * - Kategori attribute: { id, name, categoryAttributes: [...] }
 * - SOAP: XML → parsed { status: "success"|"failure", errorMessage? }
 */
export class N11ResponseInterpreter extends BaseResponseInterpreter {
    interpret(response: any, operationType: OperationType): InterpretedResponse | null {
        if (this.isEmptyResponse(response)) {
            return null;
        }

        try {
            switch (operationType) {
                case OperationType.SEND_PRODUCTS:
                case OperationType.UPDATE_PRODUCTS:
                    return this.interpretProductTask(response);

                case OperationType.GET_BATCH_STATUS:
                    return this.interpretTaskDetails(response);

                case OperationType.UPDATE_STOCK:
                case OperationType.UPDATE_PRICES:
                case OperationType.UPDATE_STOCK_AND_PRICE:
                    return this.interpretPriceStockTask(response, operationType);

                case OperationType.FETCH_PRODUCTS:
                    return this.interpretProductQuery(response);

                case OperationType.FETCH_ORDERS:
                    return this.interpretOrderList(response);

                case OperationType.UPDATE_ORDER:
                    return this.interpretOrderUpdate(response);

                case OperationType.GET_CATEGORIES:
                    return this.interpretCategoryList(response);

                case OperationType.GET_CATEGORY_ATTRIBUTES:
                    return this.interpretCategoryAttributes(response);

                case OperationType.GET_BRANDS:
                    return this.interpretBrandList(response);

                // ===== SOAP İşlemleri =====
                case OperationType.FETCH_CLAIMS:
                    return this.interpretClaimList(response);

                case OperationType.ACCEPT_CLAIM:
                    return this.interpretClaimAction(response, 'onay');

                case OperationType.REJECT_CLAIM:
                    return this.interpretClaimAction(response, 'red');

                case OperationType.SEND_TRACKING:
                    return this.interpretShipmentAction(response);

                case OperationType.SEND_INVOICES:
                    return this.interpretInvoiceAction(response);

                case OperationType.DELETE_PRODUCTS:
                    return this.interpretDeleteProduct(response);

                case OperationType.SPLIT_PACKAGE:
                    return this.interpretSplitPackage(response);

                default:
                    return this.interpretGeneric(response, operationType);
            }
        } catch (error) {
            logger.error('Error interpreting N11 response', {
                operationType,
                error: (error as Error).message
            });
            return null;
        }
    }

    /**
     * Ürün oluşturma/güncelleme task yanıtı
     * N11: { id: taskId, type: "PRODUCT_CREATE", status: "IN_QUEUE"|"REJECT", reasons: [...] }
     */
    private interpretProductTask(response: any): InterpretedResponse {
        const taskId = response?.id;
        const status = response?.status; // IN_QUEUE veya REJECT
        const type = response?.type;     // PRODUCT_CREATE, PRODUCT_UPDATE
        const reasons = response?.reasons || [];

        if (status === 'REJECT') {
            return {
                summary: `Ürün işlemi reddedildi: ${reasons.join(', ')}`,
                success: false,
                successCount: 0,
                failureCount: 1,
                details: { taskId, type, status, reasons },
                parsedAt: new Date()
            };
        }

        return {
            summary: `Ürün işlemi kuyruğa alındı (Task ID: ${taskId})`,
            success: true,
            successCount: 1,
            failureCount: 0,
            details: { taskId, type, status, reasons },
            parsedAt: new Date()
        };
    }

    /**
     * Task Details yanıtı (POST /ms/product/task-details/page-query)
     * N11: { taskId, skus: { content: [{ itemCode, status: "SUCCESS"|"FAIL", sku: {...} }] }, status: "PROCESSED" }
     */
    private interpretTaskDetails(response: any): InterpretedResponse {
        const taskStatus = response?.status; // PROCESSED, IN_QUEUE, REJECT
        const content = response?.skus?.content || [];

        const successCount = content.filter((item: any) => item.status === 'SUCCESS').length;
        const failureCount = content.filter((item: any) => item.status === 'FAIL').length;

        const failedItems = content
            .filter((item: any) => item.status === 'FAIL')
            .map((item: any) => ({
                stockCode: item.itemCode,
                reasons: item.reasons || item.sku?.reasons || []
            }));

        if (taskStatus === 'IN_QUEUE') {
            return {
                summary: `Task işleniyor (Task ID: ${response?.taskId})`,
                success: true,
                successCount: 0,
                failureCount: 0,
                details: { taskId: response?.taskId, status: taskStatus },
                parsedAt: new Date()
            };
        }

        return {
            summary: `Task tamamlandı: ${successCount} başarılı, ${failureCount} başarısız`,
            success: failureCount === 0,
            successCount,
            failureCount,
            details: {
                taskId: response?.taskId,
                status: taskStatus,
                totalElements: response?.skus?.totalElements,
                failedItems: failedItems.length > 0 ? failedItems : undefined
            },
            parsedAt: new Date()
        };
    }

    /**
     * Fiyat/Stok güncelleme task yanıtı
     * N11: { id: taskId, type: "SKU_UPDATE", status: "IN_QUEUE"|"REJECT", reasons: [...] }
     */
    private interpretPriceStockTask(response: any, operationType: OperationType): InterpretedResponse {
        const taskId = response?.id;
        const status = response?.status;
        const reasons = response?.reasons || [];

        const opLabel = operationType === OperationType.UPDATE_STOCK ? 'Stok'
            : operationType === OperationType.UPDATE_PRICES ? 'Fiyat'
            : 'Fiyat/Stok';

        if (status === 'REJECT') {
            return {
                summary: `${opLabel} güncelleme reddedildi: ${reasons.join(', ')}`,
                success: false,
                successCount: 0,
                failureCount: 1,
                details: { taskId, status, reasons, operationType },
                parsedAt: new Date()
            };
        }

        return {
            summary: `${opLabel} güncelleme kuyruğa alındı (Task ID: ${taskId})`,
            success: true,
            successCount: 1,
            failureCount: 0,
            details: { taskId, status, reasons, operationType },
            parsedAt: new Date()
        };
    }

    /**
     * Ürün sorgulama yanıtı (GET /ms/product-query)
     * N11: { content: [...], totalElements, totalPages, number, size, empty }
     */
    private interpretProductQuery(response: any): InterpretedResponse {
        const content = response?.content || [];
        const totalElements = response?.totalElements || content.length;

        return {
            summary: `${totalElements} ürün getirildi`,
            success: true,
            successCount: content.length,
            details: {
                totalElements,
                totalPages: response?.totalPages,
                currentPage: response?.number,
                pageSize: response?.size,
                empty: response?.empty
            },
            parsedAt: new Date()
        };
    }

    /**
     * Sipariş listeleme yanıtı (GET /rest/delivery/v1/shipmentPackages)
     * N11: { content: [...], totalPages, page, size }
     */
    private interpretOrderList(response: any): InterpretedResponse {
        const content = response?.content || [];
        const totalPages = response?.totalPages || 1;

        return {
            summary: `${content.length} sipariş paketi getirildi (sayfa ${(response?.page || 0) + 1}/${totalPages})`,
            success: true,
            successCount: content.length,
            details: {
                packageCount: content.length,
                totalPages,
                page: response?.page,
                size: response?.size,
                statuses: content.reduce((acc: Record<string, number>, pkg: any) => {
                    const status = pkg.shipmentPackageStatus || 'Unknown';
                    acc[status] = (acc[status] || 0) + 1;
                    return acc;
                }, {})
            },
            parsedAt: new Date()
        };
    }

    /**
     * Sipariş güncelleme yanıtı (PUT /rest/order/v1/update)
     * N11: { content: [{ lineId, status: "SUCCESS"|"FAIL", reasons }] }
     */
    private interpretOrderUpdate(response: any): InterpretedResponse {
        const content = response?.content || [];
        const successCount = content.filter((item: any) => item.status === 'SUCCESS').length;
        const failureCount = content.filter((item: any) => item.status !== 'SUCCESS').length;

        return {
            summary: `Sipariş güncelleme: ${successCount} başarılı, ${failureCount} başarısız`,
            success: failureCount === 0,
            successCount,
            failureCount,
            details: {
                items: content.map((item: any) => ({
                    lineId: item.lineId,
                    status: item.status,
                    reasons: item.reasons
                }))
            },
            parsedAt: new Date()
        };
    }

    /**
     * Kategori listesi (GET /cdn/categories)
     * N11: Array yapısı — her biri { id, name, subCategories: [...] | null }
     */
    private interpretCategoryList(response: any): InterpretedResponse {
        const categories = Array.isArray(response) ? response
            : response?.categories || response?.content || [];
        const categoryCount = Array.isArray(categories) ? categories.length : 0;

        return {
            summary: `${categoryCount} kök kategori getirildi`,
            success: true,
            successCount: categoryCount,
            details: {
                rootCategoryCount: categoryCount,
                hasSubCategories: categories.some((cat: any) =>
                    cat.subCategories && cat.subCategories !== null
                )
            },
            parsedAt: new Date()
        };
    }

    /**
     * Kategori attribute'ları (GET /cdn/category/{id}/attribute)
     * N11: { id, name, categoryAttributes: [{ attributeId, attributeName, isMandatory, isVariant, ... }] }
     */
    private interpretCategoryAttributes(response: any): InterpretedResponse {
        const attributes = response?.categoryAttributes || [];
        const attributeCount = Array.isArray(attributes) ? attributes.length : 0;
        const mandatoryCount = attributes.filter((attr: any) => attr.isMandatory).length;
        const variantCount = attributes.filter((attr: any) => attr.isVariant).length;

        return {
            summary: `${attributeCount} özellik getirildi (${mandatoryCount} zorunlu, ${variantCount} varyant)`,
            success: true,
            successCount: attributeCount,
            details: {
                categoryId: response?.id,
                categoryName: response?.name,
                attributeCount,
                mandatoryCount,
                variantCount
            },
            parsedAt: new Date()
        };
    }

    /**
     * Marka listesi — N11'de kategori attribute (id:1) üzerinden
     * Response: { brands: [{ id, name }], totalElements }
     */
    private interpretBrandList(response: any): InterpretedResponse {
        const brands = response?.brands || [];
        const brandCount = Array.isArray(brands) ? brands.length : 0;

        return {
            summary: `${brandCount} marka getirildi`,
            success: true,
            successCount: brandCount,
            details: { brandCount, totalElements: response?.totalElements },
            parsedAt: new Date()
        };
    }

    // ===== SOAP RESPONSE INTERPRETERS =====

    /**
     * İade listesi (SOAP ReturnService → ClaimReturnList)
     * Response: { content: [...], totalCount, pageCount } (api-client wrapper)
     */
    private interpretClaimList(response: any): InterpretedResponse {
        const returns = response?.content || response?.returns || [];
        const totalCount = response?.totalCount || returns.length;

        return {
            summary: `${totalCount} iade talebi getirildi`,
            success: true,
            successCount: returns.length,
            details: {
                totalCount,
                pageCount: response?.pageCount,
                statuses: returns.reduce((acc: Record<string, number>, r: any) => {
                    const status = r.status || 'Unknown';
                    acc[status] = (acc[status] || 0) + 1;
                    return acc;
                }, {})
            },
            parsedAt: new Date()
        };
    }

    /**
     * İade onay/red (SOAP ReturnService → ClaimReturnApprove/Deny)
     * Response: { success: boolean, message: string }
     */
    private interpretClaimAction(response: any, action: string): InterpretedResponse {
        const success = response?.success === true;

        return {
            summary: success ? `İade ${action}landı` : `İade ${action} başarısız: ${response?.message || ''}`,
            success,
            successCount: success ? 1 : 0,
            failureCount: success ? 0 : 1,
            details: { action, message: response?.message },
            parsedAt: new Date()
        };
    }

    /**
     * Kargo bilgisi gönderme (SOAP OrderService → MakeOrderItemShipment)
     * Response: { success: boolean, message: string }
     */
    private interpretShipmentAction(response: any): InterpretedResponse {
        const success = response?.success === true;

        return {
            summary: success ? 'Kargo bilgisi gönderildi' : `Kargo gönderimi başarısız: ${response?.message || ''}`,
            success,
            successCount: success ? 1 : 0,
            failureCount: success ? 0 : 1,
            details: { message: response?.message },
            parsedAt: new Date()
        };
    }

    /**
     * Fatura linki gönderme (SOAP SellerInvoiceService → SaveLinkSellerInvoice)
     * Response: { success: boolean, message: string }
     */
    private interpretInvoiceAction(response: any): InterpretedResponse {
        const success = response?.success === true;

        return {
            summary: success ? 'Fatura linki iletildi' : `Fatura linki gönderimi başarısız: ${response?.message || ''}`,
            success,
            successCount: success ? 1 : 0,
            failureCount: success ? 0 : 1,
            details: { message: response?.message },
            parsedAt: new Date()
        };
    }

    /**
     * Ürün silme (SOAP ProductService → DeleteProductBySellerCode)
     * Response: { success: boolean, message: string }
     */
    private interpretDeleteProduct(response: any): InterpretedResponse {
        const success = response?.success === true;

        return {
            summary: success ? 'Ürün silindi' : `Ürün silme başarısız: ${response?.message || ''}`,
            success,
            successCount: success ? 1 : 0,
            failureCount: success ? 0 : 1,
            details: { message: response?.message },
            parsedAt: new Date()
        };
    }

    /**
     * Paket bölme (REST POST /rest/delivery/v1/splitCombinePackage)
     * Response: { code: 200, message: "success" }
     */
    private interpretSplitPackage(response: any): InterpretedResponse {
        const success = response?.code === 200;

        return {
            summary: success ? 'Paket bölme başarılı' : `Paket bölme başarısız: ${response?.message || ''}`,
            success,
            successCount: success ? 1 : 0,
            failureCount: success ? 0 : 1,
            details: { code: response?.code, message: response?.message },
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
