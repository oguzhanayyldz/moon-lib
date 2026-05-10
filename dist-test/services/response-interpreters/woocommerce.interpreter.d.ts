import { OperationType } from '../../enums/operation-type.enum';
import { InterpretedResponse } from '../../models/integrationRequestLog.schema';
import { BaseResponseInterpreter } from './base.interpreter';
/**
 * WooCommerce REST API yanıtlarını yorumlayan interpreter
 * WP REST API v3 (/wp-json/wc/v3) format'ı
 */
export declare class WooCommerceResponseInterpreter extends BaseResponseInterpreter {
    interpret(response: any, operationType: OperationType): InterpretedResponse | null;
    private interpretWcError;
    /**
     * Ürün create/update yanıtı (tek nesne döner)
     */
    private interpretProductOperation;
    /**
     * Ürün list yanıtı (array doğrudan döner — `products` wrapper YOK)
     */
    private interpretProductList;
    /**
     * Sipariş create/update yanıtı (tek nesne döner)
     */
    private interpretOrderOperation;
    /**
     * Sipariş list yanıtı (array doğrudan döner)
     */
    private interpretOrderList;
    /**
     * Stok güncelleme yanıtı (product update'in alt kümesi: stock_quantity + stock_status)
     */
    private interpretStockUpdate;
    private interpretGeneric;
}
//# sourceMappingURL=woocommerce.interpreter.d.ts.map