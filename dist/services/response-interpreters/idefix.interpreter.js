"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdefixResponseInterpreter = void 0;
const operation_type_enum_1 = require("../../enums/operation-type.enum");
const base_interpreter_1 = require("./base.interpreter");
const logger_service_1 = require("../logger.service");
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
class IdefixResponseInterpreter extends base_interpreter_1.BaseResponseInterpreter {
    interpret(response, operationType) {
        if (this.isEmptyResponse(response)) {
            return null;
        }
        try {
            switch (operationType) {
                case operation_type_enum_1.OperationType.GET_BATCH_STATUS:
                    return this.interpretBatchStatus(response);
                case operation_type_enum_1.OperationType.SEND_PRODUCTS:
                    return this.interpretBatchRequest(response);
                default:
                    return this.interpretGeneric(response, operationType);
            }
        }
        catch (error) {
            logger_service_1.logger.error('Error interpreting Idefix response', {
                operationType,
                error: error.message
            });
            return null;
        }
    }
    /**
     * Ürün/stok-fiyat gönderim yanıtını yorumla
     * İdefix response: { batchRequestId: "xxx" }
     */
    interpretBatchRequest(response) {
        var _a;
        const batchRequestId = response === null || response === void 0 ? void 0 : response.batchRequestId;
        const itemCount = (response === null || response === void 0 ? void 0 : response.itemCount) || ((_a = response === null || response === void 0 ? void 0 : response.products) === null || _a === void 0 ? void 0 : _a.length) || 0;
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
    interpretBatchStatus(response) {
        var _a, _b;
        const summary = response === null || response === void 0 ? void 0 : response.summary;
        if (!summary || typeof summary !== 'object') {
            // Bu şekle sahip olmayan bir gövde hiçbir üretim yolunda loglanmıyor;
            // savunma amaçlı genel bir yanıta düş.
            return this.interpretGeneric(response, operation_type_enum_1.OperationType.GET_BATCH_STATUS);
        }
        const status = response.status; // COMPLETED, PARTIAL, FAILED, TIMEOUT, MAX_ATTEMPTS_EXCEEDED
        const successCount = summary.success || 0;
        const failureCount = summary.failed || 0;
        const totalCount = summary.total || (successCount + failureCount);
        // Sayaçlar, servisin bildirdiği status alanından önceliklidir: bir batch
        // status='COMPLETED' desin, summary.failed>0 ise gerçekte kısmen başarılıdır.
        let interpretedStatus = 'pending';
        if (failureCount > 0 && successCount > 0)
            interpretedStatus = 'partial';
        else if (failureCount > 0 && successCount === 0)
            interpretedStatus = 'failed';
        else if (status === 'COMPLETED')
            interpretedStatus = 'completed';
        else if (status === 'PARTIAL')
            interpretedStatus = 'partial';
        else if (status === 'FAILED' || status === 'TIMEOUT' || status === 'MAX_ATTEMPTS_EXCEEDED')
            interpretedStatus = 'failed';
        let summaryMessage = '';
        if (interpretedStatus === 'completed') {
            summaryMessage = `Batch tamamlandı: ${successCount} ürün başarılı`;
        }
        else if (interpretedStatus === 'failed') {
            summaryMessage = status === 'TIMEOUT' || status === 'MAX_ATTEMPTS_EXCEEDED'
                ? `Batch zaman aşımına uğradı: İdefix bu toplu işlemin bittiğini bildirmedi (${failureCount} sonucu belirsiz)`
                : `Batch başarısız: ${failureCount} ürün reddedildi`;
        }
        else if (interpretedStatus === 'partial') {
            summaryMessage = `Batch kısmen başarılı: ${successCount} başarılı, ${failureCount} başarısız`;
        }
        else {
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
                successItems: ((_a = response.successItems) === null || _a === void 0 ? void 0 : _a.slice(0, 20)) || [],
                failedItems: ((_b = response.failedItems) === null || _b === void 0 ? void 0 : _b.slice(0, 20)) || []
            },
            parsedAt: new Date()
        };
    }
    /**
     * Genel yanıt yorumlama
     */
    interpretGeneric(response, operationType) {
        const isSuccess = (response === null || response === void 0 ? void 0 : response.success) !== false;
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
exports.IdefixResponseInterpreter = IdefixResponseInterpreter;
