import { OperationType } from '../../enums/operation-type.enum';
import { InterpretedResponse } from '../../models/integrationRequestLog.schema';
import { BaseResponseInterpreter } from './base.interpreter';
/**
 * Hepsiburada API yanıtlarını yorumlayan interpreter
 *
 * Hepsiburada API Response Formatları:
 * - Batch Status: { success: true, data: [{ importStatus, productStatus, validationResults }] }
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
     * Hepsiburada response format:
     * {
     *   "success": true,
     *   "data": [{
     *     "merchantSku": "xxx",
     *     "barcode": "xxx",
     *     "hbSku": null,
     *     "importStatus": "SUCCESS" | "FAILED",
     *     "productStatus": "Incelenecek" | "Matched" | "ForSale" | "Rejected",
     *     "validationResults": [{ "attributeName": "...", "message": "..." }]
     *   }]
     * }
     */
    private interpretBatchStatus;
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
}
