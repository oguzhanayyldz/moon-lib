import { OperationType } from '../../enums/operation-type.enum';
import { InterpretedResponse } from '../../models/integrationRequestLog.schema';
import { BaseResponseInterpreter } from './base.interpreter';
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
export declare class N11ResponseInterpreter extends BaseResponseInterpreter {
    interpret(response: any, operationType: OperationType): InterpretedResponse | null;
    /**
     * Ürün oluşturma/güncelleme task yanıtı
     * N11: { id: taskId, type: "PRODUCT_CREATE", status: "IN_QUEUE"|"REJECT", reasons: [...] }
     */
    private interpretProductTask;
    /**
     * Task Details yanıtı (POST /ms/product/task-details/page-query)
     * N11: { taskId, skus: { content: [{ itemCode, status: "SUCCESS"|"FAIL", sku: {...} }] }, status: "PROCESSED" }
     */
    private interpretTaskDetails;
    /**
     * Fiyat/Stok güncelleme task yanıtı
     * N11: { id: taskId, type: "SKU_UPDATE", status: "IN_QUEUE"|"REJECT", reasons: [...] }
     */
    private interpretPriceStockTask;
    /**
     * Ürün sorgulama yanıtı (GET /ms/product-query)
     * N11: { content: [...], totalElements, totalPages, number, size, empty }
     */
    private interpretProductQuery;
    /**
     * Sipariş listeleme yanıtı (GET /rest/delivery/v1/shipmentPackages)
     * N11: { content: [...], totalPages, page, size }
     */
    private interpretOrderList;
    /**
     * Sipariş güncelleme yanıtı (PUT /rest/order/v1/update)
     * N11: { content: [{ lineId, status: "SUCCESS"|"FAIL", reasons }] }
     */
    private interpretOrderUpdate;
    /**
     * Kategori listesi (GET /cdn/categories)
     * N11: Array yapısı — her biri { id, name, subCategories: [...] | null }
     */
    private interpretCategoryList;
    /**
     * Kategori attribute'ları (GET /cdn/category/{id}/attribute)
     * N11: { id, name, categoryAttributes: [{ attributeId, attributeName, isMandatory, isVariant, ... }] }
     */
    private interpretCategoryAttributes;
    /**
     * Marka listesi — N11'de kategori attribute (id:1) üzerinden
     * Response: { brands: [{ id, name }], totalElements }
     */
    private interpretBrandList;
    private interpretGeneric;
}
