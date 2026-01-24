import { OperationType } from '../../enums/operation-type.enum';
import { InterpretedResponse } from '../../models/integrationRequestLog.schema';
import { BaseResponseInterpreter } from './base.interpreter';
/**
 * Hepsiburada API yanıtlarını yorumlayan interpreter
 *
 * Hepsiburada API Response Formatları:
 * - Batch Status (Ticket API): { success: true, data: [{ importStatus, productStatus, validationResults }] }
 * - Batch Status (Tracking): { status, summary: { total, success, failed }, successItems, failedItems }
 * - Tracking: { trackingId: "xxx" }
 * - Categories: { data: { categories: [...] } }
 * - Brands: { data: { brands: [...] } }
 */
export declare class HepsiburadaResponseInterpreter extends BaseResponseInterpreter {
    interpret(response: any, operationType: OperationType): InterpretedResponse | null;
    /**
     * Batch request (ürün upload) yanıtını yorumla
     * Hepsiburada response: { trackingId: "xxx" }
     */
    private interpretBatchRequest;
    /**
     * Batch status (tracking status) yanıtını yorumla
     *
     * İki farklı format desteklenir:
     *
     * 1. Batch Tracking Format (processBatchResults'tan gelen - fiyat/stok):
     * {
     *   "trackingId": "xxx",
     *   "status": "COMPLETED" | "PARTIAL" | "FAILED",
     *   "summary": { "total": 1, "success": 1, "failed": 0 },
     *   "successItems": [{ "hbSku": "xxx", "status": "SUCCESS" }],
     *   "failedItems": []
     * }
     *
     * 2. Ticket API Format (ürün upload sonuçları):
     * {
     *   "success": true,
     *   "data": [{
     *     "merchantSku": "xxx",
     *     "importStatus": "SUCCESS" | "FAILED",
     *     "productStatus": "ForSale" | "Rejected",
     *     "validationResults": [{ "attributeName": "...", "message": "..." }]
     *   }]
     * }
     */
    private interpretBatchStatus;
    /**
     * Batch tracking formatını yorumla (processBatchResults'tan gelen)
     * Format: { trackingId, status, summary: { total, success, failed }, successItems, failedItems }
     */
    private interpretBatchTrackingFormat;
    /**
     * Ticket API formatını yorumla (ürün upload sonuçları)
     * Format: { data: [{ merchantSku, importStatus, productStatus, validationResults }] }
     */
    private interpretTicketApiFormat;
    /**
     * Kategori listesi yanıtını yorumla
     * Hepsiburada response: { data: { categories: [...] } }
     */
    private interpretCategoryList;
    /**
     * Marka listesi yanıtını yorumla
     * Hepsiburada response: { data: { brands: [...] } }
     */
    private interpretBrandList;
    /**
     * Kategori attribute'ları yorumla
     * Hepsiburada response: { data: { attributes: [...] } }
     */
    private interpretCategoryAttributes;
    /**
     * Stok ve/veya fiyat güncelleme yanıtını yorumla
     * Hepsiburada stok/fiyat güncelleme trackingId döndürebilir
     */
    private interpretStockAndPriceUpdate;
    /**
     * Ürün gönderimi/güncelleme yanıtını yorumla
     * TrackingId veya success/fail bilgisi içerebilir
     */
    private interpretProductSendUpdate;
    /**
     * Genel yanıt yorumlama
     */
    private interpretGeneric;
    /**
     * Paketlenebilir ürünler listesi yanıtını yorumla
     * Response format: { lineItems: [...] }
     */
    private interpretPackageableItems;
    /**
     * Paket oluşturma yanıtını yorumla
     * Response format: { packageNumber: "...", barcode: "..." }
     */
    private interpretCreatePackage;
    /**
     * Paket listesi yanıtını yorumla
     */
    private interpretFetchPackages;
    /**
     * Paket bölme yanıtını yorumla
     */
    private interpretSplitPackage;
    /**
     * Paket açma yanıtını yorumla
     */
    private interpretUnpackPackage;
    /**
     * Line item iptal yanıtını yorumla
     */
    private interpretCancelLineItem;
}
