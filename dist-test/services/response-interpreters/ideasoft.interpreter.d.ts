import { OperationType } from '../../enums/operation-type.enum';
import { InterpretedResponse } from '../../models/integrationRequestLog.schema';
import { BaseResponseInterpreter } from './base.interpreter';
/**
 * IdeaSoft Admin API (REST) yanıtlarını yorumlayan interpreter
 * IdeaSoft tüm işlemlerini REST endpoint'leri üzerinden yapar
 */
export declare class IdeaSoftResponseInterpreter extends BaseResponseInterpreter {
    interpret(response: any, operationType: OperationType): InterpretedResponse | null;
    /**
     * Hata yanıtını yorumla
     */
    private interpretErrorResponse;
    /**
     * Liste yanıtını yorumla (array response)
     */
    private interpretListResponse;
    /**
     * Ürün listesi yanıtını yorumla
     */
    private interpretProductList;
    /**
     * Ürün create/update işlemi yanıtını yorumla
     */
    private interpretProductOperation;
    /**
     * Sipariş listesi yanıtını yorumla
     */
    private interpretOrderList;
    /**
     * Sipariş create/update işlemi yanıtını yorumla
     */
    private interpretOrderOperation;
    /**
     * Stok güncelleme yanıtını yorumla
     */
    private interpretStockUpdate;
    /**
     * Kargo/shipment güncelleme yanıtını yorumla
     */
    private interpretShipmentUpdate;
    /**
     * Genel yanıt yorumlama
     */
    private interpretGeneric;
}
//# sourceMappingURL=ideasoft.interpreter.d.ts.map