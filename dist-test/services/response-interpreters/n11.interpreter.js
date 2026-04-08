"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.N11ResponseInterpreter = void 0;
const operation_type_enum_1 = require("../../enums/operation-type.enum");
const base_interpreter_1 = require("./base.interpreter");
const logger_service_1 = require("../logger.service");
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
class N11ResponseInterpreter extends base_interpreter_1.BaseResponseInterpreter {
    interpret(response, operationType) {
        if (this.isEmptyResponse(response)) {
            return null;
        }
        try {
            switch (operationType) {
                case operation_type_enum_1.OperationType.SEND_PRODUCTS:
                case operation_type_enum_1.OperationType.UPDATE_PRODUCTS:
                    return this.interpretProductTask(response);
                case operation_type_enum_1.OperationType.GET_BATCH_STATUS:
                    return this.interpretTaskDetails(response);
                case operation_type_enum_1.OperationType.UPDATE_STOCK:
                case operation_type_enum_1.OperationType.UPDATE_PRICES:
                case operation_type_enum_1.OperationType.UPDATE_STOCK_AND_PRICE:
                    return this.interpretPriceStockTask(response, operationType);
                case operation_type_enum_1.OperationType.FETCH_PRODUCTS:
                    return this.interpretProductQuery(response);
                case operation_type_enum_1.OperationType.FETCH_ORDERS:
                    return this.interpretOrderList(response);
                case operation_type_enum_1.OperationType.UPDATE_ORDER:
                    return this.interpretOrderUpdate(response);
                case operation_type_enum_1.OperationType.GET_CATEGORIES:
                    return this.interpretCategoryList(response);
                case operation_type_enum_1.OperationType.GET_CATEGORY_ATTRIBUTES:
                    return this.interpretCategoryAttributes(response);
                case operation_type_enum_1.OperationType.GET_BRANDS:
                    return this.interpretBrandList(response);
                // ===== SOAP İşlemleri =====
                case operation_type_enum_1.OperationType.FETCH_CLAIMS:
                    return this.interpretClaimList(response);
                case operation_type_enum_1.OperationType.ACCEPT_CLAIM:
                    return this.interpretClaimAction(response, 'onay');
                case operation_type_enum_1.OperationType.REJECT_CLAIM:
                    return this.interpretClaimAction(response, 'red');
                case operation_type_enum_1.OperationType.SEND_TRACKING:
                    return this.interpretShipmentAction(response);
                case operation_type_enum_1.OperationType.SEND_INVOICES:
                    return this.interpretInvoiceAction(response);
                case operation_type_enum_1.OperationType.DELETE_PRODUCTS:
                    return this.interpretDeleteProduct(response);
                case operation_type_enum_1.OperationType.SPLIT_PACKAGE:
                    return this.interpretSplitPackage(response);
                default:
                    return this.interpretGeneric(response, operationType);
            }
        }
        catch (error) {
            logger_service_1.logger.error('Error interpreting N11 response', {
                operationType,
                error: error.message
            });
            return null;
        }
    }
    /**
     * Ürün oluşturma/güncelleme task yanıtı
     * N11: { id: taskId, type: "PRODUCT_CREATE", status: "IN_QUEUE"|"REJECT", reasons: [...] }
     */
    interpretProductTask(response) {
        const taskId = response === null || response === void 0 ? void 0 : response.id;
        const status = response === null || response === void 0 ? void 0 : response.status; // IN_QUEUE veya REJECT
        const type = response === null || response === void 0 ? void 0 : response.type; // PRODUCT_CREATE, PRODUCT_UPDATE
        const reasons = (response === null || response === void 0 ? void 0 : response.reasons) || [];
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
    interpretTaskDetails(response) {
        var _a, _b;
        const taskStatus = response === null || response === void 0 ? void 0 : response.status; // PROCESSED, IN_QUEUE, REJECT
        const content = ((_a = response === null || response === void 0 ? void 0 : response.skus) === null || _a === void 0 ? void 0 : _a.content) || [];
        const successCount = content.filter((item) => item.status === 'SUCCESS').length;
        const failureCount = content.filter((item) => item.status === 'FAIL').length;
        const failedItems = content
            .filter((item) => item.status === 'FAIL')
            .map((item) => {
            var _a;
            return ({
                stockCode: item.itemCode,
                reasons: item.reasons || ((_a = item.sku) === null || _a === void 0 ? void 0 : _a.reasons) || []
            });
        });
        if (taskStatus === 'IN_QUEUE') {
            return {
                summary: `Task işleniyor (Task ID: ${response === null || response === void 0 ? void 0 : response.taskId})`,
                success: true,
                successCount: 0,
                failureCount: 0,
                details: { taskId: response === null || response === void 0 ? void 0 : response.taskId, status: taskStatus },
                parsedAt: new Date()
            };
        }
        return {
            summary: `Task tamamlandı: ${successCount} başarılı, ${failureCount} başarısız`,
            success: failureCount === 0,
            successCount,
            failureCount,
            details: {
                taskId: response === null || response === void 0 ? void 0 : response.taskId,
                status: taskStatus,
                totalElements: (_b = response === null || response === void 0 ? void 0 : response.skus) === null || _b === void 0 ? void 0 : _b.totalElements,
                failedItems: failedItems.length > 0 ? failedItems : undefined
            },
            parsedAt: new Date()
        };
    }
    /**
     * Fiyat/Stok güncelleme task yanıtı
     * N11: { id: taskId, type: "SKU_UPDATE", status: "IN_QUEUE"|"REJECT", reasons: [...] }
     */
    interpretPriceStockTask(response, operationType) {
        const taskId = response === null || response === void 0 ? void 0 : response.id;
        const status = response === null || response === void 0 ? void 0 : response.status;
        const reasons = (response === null || response === void 0 ? void 0 : response.reasons) || [];
        const opLabel = operationType === operation_type_enum_1.OperationType.UPDATE_STOCK ? 'Stok'
            : operationType === operation_type_enum_1.OperationType.UPDATE_PRICES ? 'Fiyat'
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
    interpretProductQuery(response) {
        const content = (response === null || response === void 0 ? void 0 : response.content) || [];
        const totalElements = (response === null || response === void 0 ? void 0 : response.totalElements) || content.length;
        return {
            summary: `${totalElements} ürün getirildi`,
            success: true,
            successCount: content.length,
            details: {
                totalElements,
                totalPages: response === null || response === void 0 ? void 0 : response.totalPages,
                currentPage: response === null || response === void 0 ? void 0 : response.number,
                pageSize: response === null || response === void 0 ? void 0 : response.size,
                empty: response === null || response === void 0 ? void 0 : response.empty
            },
            parsedAt: new Date()
        };
    }
    /**
     * Sipariş listeleme yanıtı (GET /rest/delivery/v1/shipmentPackages)
     * N11: { content: [...], totalPages, page, size }
     */
    interpretOrderList(response) {
        const content = (response === null || response === void 0 ? void 0 : response.content) || [];
        const totalPages = (response === null || response === void 0 ? void 0 : response.totalPages) || 1;
        return {
            summary: `${content.length} sipariş paketi getirildi (sayfa ${((response === null || response === void 0 ? void 0 : response.page) || 0) + 1}/${totalPages})`,
            success: true,
            successCount: content.length,
            details: {
                packageCount: content.length,
                totalPages,
                page: response === null || response === void 0 ? void 0 : response.page,
                size: response === null || response === void 0 ? void 0 : response.size,
                statuses: content.reduce((acc, pkg) => {
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
    interpretOrderUpdate(response) {
        const content = (response === null || response === void 0 ? void 0 : response.content) || [];
        const successCount = content.filter((item) => item.status === 'SUCCESS').length;
        const failureCount = content.filter((item) => item.status !== 'SUCCESS').length;
        return {
            summary: `Sipariş güncelleme: ${successCount} başarılı, ${failureCount} başarısız`,
            success: failureCount === 0,
            successCount,
            failureCount,
            details: {
                items: content.map((item) => ({
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
    interpretCategoryList(response) {
        const categories = Array.isArray(response) ? response
            : (response === null || response === void 0 ? void 0 : response.categories) || (response === null || response === void 0 ? void 0 : response.content) || [];
        const categoryCount = Array.isArray(categories) ? categories.length : 0;
        return {
            summary: `${categoryCount} kök kategori getirildi`,
            success: true,
            successCount: categoryCount,
            details: {
                rootCategoryCount: categoryCount,
                hasSubCategories: categories.some((cat) => cat.subCategories && cat.subCategories !== null)
            },
            parsedAt: new Date()
        };
    }
    /**
     * Kategori attribute'ları (GET /cdn/category/{id}/attribute)
     * N11: { id, name, categoryAttributes: [{ attributeId, attributeName, isMandatory, isVariant, ... }] }
     */
    interpretCategoryAttributes(response) {
        const attributes = (response === null || response === void 0 ? void 0 : response.categoryAttributes) || [];
        const attributeCount = Array.isArray(attributes) ? attributes.length : 0;
        const mandatoryCount = attributes.filter((attr) => attr.isMandatory).length;
        const variantCount = attributes.filter((attr) => attr.isVariant).length;
        return {
            summary: `${attributeCount} özellik getirildi (${mandatoryCount} zorunlu, ${variantCount} varyant)`,
            success: true,
            successCount: attributeCount,
            details: {
                categoryId: response === null || response === void 0 ? void 0 : response.id,
                categoryName: response === null || response === void 0 ? void 0 : response.name,
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
    interpretBrandList(response) {
        const brands = (response === null || response === void 0 ? void 0 : response.brands) || [];
        const brandCount = Array.isArray(brands) ? brands.length : 0;
        return {
            summary: `${brandCount} marka getirildi`,
            success: true,
            successCount: brandCount,
            details: { brandCount, totalElements: response === null || response === void 0 ? void 0 : response.totalElements },
            parsedAt: new Date()
        };
    }
    // ===== SOAP RESPONSE INTERPRETERS =====
    /**
     * İade listesi (SOAP ReturnService → ClaimReturnList)
     * Response: { content: [...], totalCount, pageCount } (api-client wrapper)
     */
    interpretClaimList(response) {
        const returns = (response === null || response === void 0 ? void 0 : response.content) || (response === null || response === void 0 ? void 0 : response.returns) || [];
        const totalCount = (response === null || response === void 0 ? void 0 : response.totalCount) || returns.length;
        return {
            summary: `${totalCount} iade talebi getirildi`,
            success: true,
            successCount: returns.length,
            details: {
                totalCount,
                pageCount: response === null || response === void 0 ? void 0 : response.pageCount,
                statuses: returns.reduce((acc, r) => {
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
    interpretClaimAction(response, action) {
        const success = (response === null || response === void 0 ? void 0 : response.success) === true;
        return {
            summary: success ? `İade ${action}landı` : `İade ${action} başarısız: ${(response === null || response === void 0 ? void 0 : response.message) || ''}`,
            success,
            successCount: success ? 1 : 0,
            failureCount: success ? 0 : 1,
            details: { action, message: response === null || response === void 0 ? void 0 : response.message },
            parsedAt: new Date()
        };
    }
    /**
     * Kargo bilgisi gönderme (SOAP OrderService → MakeOrderItemShipment)
     * Response: { success: boolean, message: string }
     */
    interpretShipmentAction(response) {
        const success = (response === null || response === void 0 ? void 0 : response.success) === true;
        return {
            summary: success ? 'Kargo bilgisi gönderildi' : `Kargo gönderimi başarısız: ${(response === null || response === void 0 ? void 0 : response.message) || ''}`,
            success,
            successCount: success ? 1 : 0,
            failureCount: success ? 0 : 1,
            details: { message: response === null || response === void 0 ? void 0 : response.message },
            parsedAt: new Date()
        };
    }
    /**
     * Fatura linki gönderme (SOAP SellerInvoiceService → SaveLinkSellerInvoice)
     * Response: { success: boolean, message: string }
     */
    interpretInvoiceAction(response) {
        const success = (response === null || response === void 0 ? void 0 : response.success) === true;
        return {
            summary: success ? 'Fatura linki iletildi' : `Fatura linki gönderimi başarısız: ${(response === null || response === void 0 ? void 0 : response.message) || ''}`,
            success,
            successCount: success ? 1 : 0,
            failureCount: success ? 0 : 1,
            details: { message: response === null || response === void 0 ? void 0 : response.message },
            parsedAt: new Date()
        };
    }
    /**
     * Ürün silme (SOAP ProductService → DeleteProductBySellerCode)
     * Response: { success: boolean, message: string }
     */
    interpretDeleteProduct(response) {
        const success = (response === null || response === void 0 ? void 0 : response.success) === true;
        return {
            summary: success ? 'Ürün silindi' : `Ürün silme başarısız: ${(response === null || response === void 0 ? void 0 : response.message) || ''}`,
            success,
            successCount: success ? 1 : 0,
            failureCount: success ? 0 : 1,
            details: { message: response === null || response === void 0 ? void 0 : response.message },
            parsedAt: new Date()
        };
    }
    /**
     * Paket bölme (REST POST /rest/delivery/v1/splitCombinePackage)
     * Response: { code: 200, message: "success" }
     */
    interpretSplitPackage(response) {
        const success = (response === null || response === void 0 ? void 0 : response.code) === 200;
        return {
            summary: success ? 'Paket bölme başarılı' : `Paket bölme başarısız: ${(response === null || response === void 0 ? void 0 : response.message) || ''}`,
            success,
            successCount: success ? 1 : 0,
            failureCount: success ? 0 : 1,
            details: { code: response === null || response === void 0 ? void 0 : response.code, message: response === null || response === void 0 ? void 0 : response.message },
            parsedAt: new Date()
        };
    }
    interpretGeneric(response, operationType) {
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
exports.N11ResponseInterpreter = N11ResponseInterpreter;
//# sourceMappingURL=n11.interpreter.js.map