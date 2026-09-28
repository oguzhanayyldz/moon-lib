import { OperationType } from '../../enums/operation-type.enum';
import { InterpretedResponse } from '../../models/integrationRequestLog.schema';
import { BaseResponseInterpreter } from './base.interpreter';
/**
 * İdefix API yanıtlarını yorumlayan interpreter
 *
 * İdefix API Response Formatları:
 * - Batch Status (idefixBatch.service `processBatchResults`'ın ürettiği özet — TEK loglanan format,
 *   ham API cevabı `{ products:[...] }` ya da `{ items:[...] }` hiç loglanmaz, `getProductBatchResult`/
 *   `getFastListingResult` çağrıları `logRequest:false` ile kendi log kaydını üretmez):
 *   { trackingId, status, apiType: 'Ticket API', summary: { total, success, failed }, successItems, failedItems }
 * - Ürün gönderimi (uploadProducts/fastListing): { batchRequestId }
 */
export declare class IdefixResponseInterpreter extends BaseResponseInterpreter {
    interpret(response: any, operationType: OperationType): InterpretedResponse | null;
    /**
     * Ürün/stok-fiyat gönderim yanıtını yorumla
     * İdefix response: { batchRequestId: "xxx" }
     */
    private interpretBatchRequest;
    /**
     * idefixBatch.service `processBatchResults`'ın ürettiği özet gövdesini yorumla.
     * Format: { trackingId, status, summary: { total, success, failed }, successItems, failedItems }
     */
    private interpretBatchStatus;
    /**
     * Genel yanıt yorumlama
     */
    private interpretGeneric;
}
//# sourceMappingURL=idefix.interpreter.d.ts.map