import { OperationType } from '../../enums/operation-type.enum';
import { InterpretedResponse } from '../../models/integrationRequestLog.schema';
/**
 * Abstract base class for response interpreters
 * Platform-specific interpreter'lar bu class'ı extend eder
 */
export declare abstract class BaseResponseInterpreter {
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
    protected interpretError(error: any, operationType: OperationType): InterpretedResponse;
    /**
     * Null/empty response kontrolü
     */
    protected isEmptyResponse(response: any): boolean;
    /**
     * Genel başarı durumu kontrolü
     */
    protected isSuccessResponse(responseStatus?: number): boolean;
}
//# sourceMappingURL=base.interpreter.d.ts.map