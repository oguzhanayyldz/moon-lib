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
     *
     * trendyolBatch.service.ts `processBatchResults`'ın IntegrationRequestLog'a yazdığı gövde,
     * Trendyol'un ham API cevabı (`{ items: [...] }`) DEĞİL — servisin kendi ürettiği özet:
     * { batchRequestId, status, summary: { total, success, failed }, successItems, failedItems,
     *   attempts, createdAt, completedAt }
     * Ham `items` alanı bu gövdede hiç yok; onu aramak her zaman 0/0 üretir.
     */
    private interpretBatchStatus;
    /**
     * trendyolBatch.service.ts'in `processBatchResults`'ta ürettiği özet gövdesini yorumla.
     * Format: { batchRequestId, status, summary: { total, success, failed }, successItems, failedItems }
     */
    private interpretBatchSummaryFormat;
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
     * V1: { categoryAttributes: [...] }
     * V2 attributes: { id, name, displayName, categoryAttributes: [...] }
     * V2 attribute values: { content: [...], totalElements, totalPages }
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
//# sourceMappingURL=trendyol.interpreter.d.ts.map