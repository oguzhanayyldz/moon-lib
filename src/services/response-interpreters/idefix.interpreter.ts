import { OperationType } from '../../enums/operation-type.enum';
import { InterpretedResponse } from '../../models/integrationRequestLog.schema';
import { BaseResponseInterpreter } from './base.interpreter';
import { logger } from '../logger.service';

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
export class IdefixResponseInterpreter extends BaseResponseInterpreter {
    interpret(response: any, operationType: OperationType): InterpretedResponse | null {
        if (this.isEmptyResponse(response)) {
            return null;
        }

        try {
            switch (operationType) {
                case OperationType.GET_BATCH_STATUS:
                    return this.interpretBatchStatus(response);

                case OperationType.SEND_PRODUCTS:
                    return this.interpretBatchRequest(response);

                default:
                    return this.interpretGeneric(response, operationType);
            }
        } catch (error) {
            logger.error('Error interpreting Idefix response', {
                operationType,
                error: (error as Error).message
            });
            return null;
        }
    }

    /**
     * Ürün/stok-fiyat gönderim yanıtını yorumla
     * İdefix response: { batchRequestId: "xxx" }
     */
    private interpretBatchRequest(response: any): InterpretedResponse {
        const batchRequestId = response?.batchRequestId;
        const itemCount = response?.itemCount || response?.products?.length || 0;

        return {
            summary: `Batch isteği oluşturuldu${batchRequestId ? ` (Batch ID: ${batchRequestId})` : ''}${itemCount > 0 ? `, ${itemCount} ürün` : ''}`,
            success: !!batchRequestId,
            successCount: itemCount,
            failureCount: 0,
            details: {
                batchRequestId,
                itemCount
            },
            parsedAt: new Date()
        };
    }

    /**
     * idefixBatch.service `processBatchResults`'ın ürettiği özet gövdesini yorumla.
     * Format: { trackingId, status, summary: { total, success, failed }, successItems, failedItems }
     */
    private interpretBatchStatus(response: any): InterpretedResponse {
        const summary = response?.summary;

        if (!summary || typeof summary !== 'object') {
            // Bu şekle sahip olmayan bir gövde hiçbir üretim yolunda loglanmıyor;
            // savunma amaçlı genel bir yanıta düş.
            return this.interpretGeneric(response, OperationType.GET_BATCH_STATUS);
        }

        const status = response.status; // COMPLETED, PARTIAL, FAILED, TIMEOUT, MAX_ATTEMPTS_EXCEEDED
        const successCount = summary.success || 0;
        const failureCount = summary.failed || 0;
        const totalCount = summary.total || (successCount + failureCount);

        let interpretedStatus: 'completed' | 'partial' | 'failed' | 'pending' = 'pending';
        if (status === 'COMPLETED') interpretedStatus = 'completed';
        else if (status === 'PARTIAL') interpretedStatus = 'partial';
        else if (status === 'FAILED' || status === 'TIMEOUT' || status === 'MAX_ATTEMPTS_EXCEEDED') interpretedStatus = 'failed';

        let summaryMessage = '';
        if (interpretedStatus === 'completed') {
            summaryMessage = `Batch tamamlandı: ${successCount} ürün başarılı`;
        } else if (interpretedStatus === 'failed') {
            summaryMessage = status === 'TIMEOUT' || status === 'MAX_ATTEMPTS_EXCEEDED'
                ? `Batch zaman aşımına uğradı: İdefix bu toplu işlemin bittiğini bildirmedi (${failureCount} sonucu belirsiz)`
                : `Batch başarısız: ${failureCount} ürün reddedildi`;
        } else if (interpretedStatus === 'partial') {
            summaryMessage = `Batch kısmen başarılı: ${successCount} başarılı, ${failureCount} başarısız`;
        } else {
            summaryMessage = 'Batch durumu: İşleniyor...';
        }

        return {
            summary: summaryMessage,
            success: failureCount === 0 && interpretedStatus !== 'failed',
            successCount,
            failureCount,
            details: {
                total: totalCount,
                status: interpretedStatus,
                successItems: response.successItems?.slice(0, 20) || [],
                failedItems: response.failedItems?.slice(0, 20) || []
            },
            parsedAt: new Date()
        };
    }

    /**
     * Genel yanıt yorumlama
     */
    private interpretGeneric(response: any, operationType: OperationType): InterpretedResponse {
        const isSuccess = response?.success !== false;

        return {
            summary: `${operationType} işlemi ${isSuccess ? 'tamamlandı' : 'başarısız'}`,
            success: isSuccess,
            details: {
                responseType: typeof response,
                hasData: !this.isEmptyResponse(response)
            },
            parsedAt: new Date()
        };
    }
}
