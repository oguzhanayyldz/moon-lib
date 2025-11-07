import { OperationType } from '../../enums/operation-type.enum';
import { InterpretedResponse } from '../../models/integrationRequestLog.schema';
import { BaseResponseInterpreter } from './base.interpreter';
/**
 * Shopify API yanıtlarını yorumlayan interpreter
 */
export declare class ShopifyResponseInterpreter extends BaseResponseInterpreter {
    interpret(response: any, operationType: OperationType): InterpretedResponse | null;
    /**
     * GraphQL yanıtını yorumla
     */
    private interpretGraphQLResponse;
    /**
     * Ürün işlemi (create/update) yanıtını yorumla
     */
    private interpretProductOperation;
    /**
     * Ürün listesi yanıtını yorumla
     */
    private interpretProductList;
    /**
     * Sipariş işlemi (create/update) yanıtını yorumla
     */
    private interpretOrderOperation;
    /**
     * Sipariş listesi yanıtını yorumla
     */
    private interpretOrderList;
    /**
     * Stok güncelleme yanıtını yorumla
     */
    private interpretInventoryUpdate;
    /**
     * Genel yanıt yorumlama
     */
    private interpretGeneric;
}
//# sourceMappingURL=shopify.interpreter.d.ts.map