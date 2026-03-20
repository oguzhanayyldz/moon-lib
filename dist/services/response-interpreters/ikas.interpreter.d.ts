import { OperationType } from '../../enums/operation-type.enum';
import { InterpretedResponse } from '../../models/integrationRequestLog.schema';
import { BaseResponseInterpreter } from './base.interpreter';
/**
 * ikas GraphQL API yanıtlarını yorumlayan interpreter
 * ikas tüm işlemlerini GraphQL üzerinden yapar (REST sadece image upload için)
 */
export declare class IkasResponseInterpreter extends BaseResponseInterpreter {
    interpret(response: any, operationType: OperationType): InterpretedResponse | null;
    /**
     * GraphQL yanıtını yorumla (ikas'ın ana response formatı)
     */
    private interpretGraphQLResponse;
    /**
     * Pagination yanıtını yorumla (listProduct, listOrder)
     */
    private interpretPaginationResponse;
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
     * Stok güncelleme yanıtını yorumla (saveVariantStocks)
     */
    private interpretStockUpdate;
    /**
     * Fulfillment (kargo gönderim) yanıtını yorumla
     */
    private interpretFulfillment;
    /**
     * Genel yanıt yorumlama
     */
    private interpretGeneric;
}
