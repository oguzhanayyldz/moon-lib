import { OperationType } from '../../enums/operation-type.enum';
import { InterpretedResponse } from '../../models/integrationRequestLog.schema';
import { BaseResponseInterpreter } from './base.interpreter';
/**
 * Trendyol API yanıtlarını yorumlayan interpreter
 */
export declare class TrendyolResponseInterpreter extends BaseResponseInterpreter {
    interpret(response: any, operationType: OperationType): InterpretedResponse | null;
    /**
     * Batch request yanıtını yorumla
     * Örnek response: { batchRequestId: "xxx", itemCount: 15 }
     */
    private interpretBatchRequest;
    /**
     * Batch status yanıtını yorumla
     * Örnek response: { items: [{status: "SUCCESS"}, {status: "FAILED"}] }
     */
    private interpretBatchStatus;
    /**
     * Kategori listesi yanıtını yorumla
     */
    private interpretCategoryList;
    /**
     * Marka listesi yanıtını yorumla
     */
    private interpretBrandList;
    /**
     * Kategori attribute'ları yorumla
     */
    private interpretCategoryAttributes;
    /**
     * Stok ve/veya fiyat güncelleme yanıtını yorumla
     * Trendyol stok/fiyat güncelleme endpoint'i batchRequestId döndürebilir
     */
    private interpretStockAndPriceUpdate;
    /**
     * Ürün gönderimi/güncelleme yanıtını yorumla
     * BatchRequestId, success/fail sayıları, hata nedenleri içerebilir
     */
    private interpretProductSendUpdate;
    /**
     * Genel yanıt yorumlama
     */
    private interpretGeneric;
}
