import { OperationType } from '../../enums/operation-type.enum';
import { InterpretedResponse } from '../../models/integrationRequestLog.schema';
import { logger } from '../logger.service';

/**
 * Abstract base class for response interpreters
 * Platform-specific interpreter'lar bu class'ı extend eder
 */
export abstract class BaseResponseInterpreter {
    /**
     * Response'u yorumlayıp InterpretedResponse formatına dönüştürür
     * @param response - Platform yanıtı (any tipinde, platform'a göre farklılık gösterir)
     * @param operationType - İşlem tipi
     * @returns Yorumlanmış yanıt
     */
    abstract interpret(response: any, operationType: OperationType): InterpretedResponse | null;

    /**
     * Varsayılan hata yorumlama
     */
    protected interpretError(error: any, operationType: OperationType): InterpretedResponse {
        const errorMessage = error?.message || error?.data?.message || 'Bilinmeyen hata';

        logger.debug('Interpreting error response', {
            operationType,
            error: errorMessage
        });

        return {
            summary: `İşlem başarısız: ${errorMessage}`,
            success: false,
            successCount: 0,
            failureCount: 1,
            details: {
                error: errorMessage,
                errorCode: error?.code || error?.status,
                errorData: error?.data
            },
            parsedAt: new Date()
        };
    }

    /**
     * Null/empty response kontrolü
     */
    protected isEmptyResponse(response: any): boolean {
        return !response ||
               response === null ||
               response === undefined ||
               (typeof response === 'object' && Object.keys(response).length === 0);
    }

    /**
     * Genel başarı durumu kontrolü
     */
    protected isSuccessResponse(responseStatus?: number): boolean {
        if (!responseStatus) return false;
        return responseStatus >= 200 && responseStatus < 300;
    }
}
