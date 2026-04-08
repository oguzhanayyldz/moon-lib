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
     * Fiyat işlemi yanıtını yorumla (GET /product_prices, PUT /product_prices/{id})
     */
    private interpretPriceOperation;
    /**
     * Marka listesi yanıtını yorumla (GET /brands)
     */
    private interpretBrandList;
    /**
     * Kategori listesi yanıtını yorumla (GET /categories)
     */
    private interpretCategoryList;
    /**
     * Kargo/shipment güncelleme yanıtını yorumla
     * IdeaSoft: Shipment CreateAction PUT, shippingTrackingCode field
     */
    private interpretShipmentUpdate;
    /**
     * İade işlemi yanıtını yorumla (GET/POST /order_refund_requests)
     */
    private interpretRefundOperation;
    /**
     * Genel yanıt yorumlama
     */
    private interpretGeneric;
}
//# sourceMappingURL=ideasoft.interpreter.d.ts.map