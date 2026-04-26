import { OperationType } from '../../enums/operation-type.enum';
import { InterpretedResponse } from '../../models/integrationRequestLog.schema';
import { BaseResponseInterpreter } from './base.interpreter';
/**
 * T-Soft Admin API (REST) yanıtlarını yorumlayan interpreter.
 *
 * T-Soft REST envelope:
 *   - List endpoint'leri:   `{ data: T[], totalCount, offset, limit }`
 *   - Single endpoint'leri: `{ data: T }`
 *   - Hata:                 `{ error?, errors?, message? }`
 *
 * Source: docs/integrations/tsoft/api-docs.md (Endpoints L450-540, Status Codes L605-650)
 */
export declare class TSoftResponseInterpreter extends BaseResponseInterpreter {
    interpret(response: any, operationType: OperationType): InterpretedResponse | null;
    /**
     * Hata yanıtını yorumla.
     * T-Soft hata formatları:
     *   - 422 Validation: `{ errors: { field: [messages] } }` (orderStatus.in, cargoCompanyId.exists, ...)
     *   - 401/403/404:    `{ error: 'message' }` veya `{ message: 'text' }`
     */
    private interpretErrorResponse;
    /**
     * Ürün listesi yanıtını yorumla.
     * T-Soft envelope: `{ data: TSoftProduct[], totalCount, offset, limit }`
     */
    private interpretProductList;
    /**
     * Ürün create/update işlemi yanıtını yorumla.
     * T-Soft single envelope: `{ data: TSoftProduct }`
     */
    private interpretProductOperation;
    /**
     * Sipariş listesi yanıtını yorumla.
     * T-Soft envelope: `{ data: TSoftOrder[], totalCount, offset, limit }`
     */
    private interpretOrderList;
    /**
     * Sipariş update yanıtını yorumla.
     * T-Soft PUT /orders/order/{id} envelope: `{ data: TSoftOrder }`
     * Order field'lari FLAT (docs L754-840: orderNumber, orderStatus, cargo*, customer*, payment*).
     */
    private interpretOrderOperation;
    /**
     * Stok güncelleme yanıtını yorumla.
     * T-Soft: PUT /catalog/products/{id} `{ stock | stock2 | stock99 }` -> `{ data: TSoftProduct }`
     */
    private interpretStockUpdate;
    /**
     * Fiyat işlemi yanıtını yorumla.
     * T-Soft prices product seviyesinde tutulur: `priceSale`, `priceDiscount`.
     */
    private interpretPriceOperation;
    /**
     * Kargo bildirimi yanıtını yorumla.
     * T-Soft: PUT /orders/order/{id} `{ cargoCompanyId, waybillNumber, cargoNumber }` -> `{ data: TSoftOrder }`
     */
    private interpretShipmentUpdate;
    /**
     * Silme/iptal işlemi yanıtını yorumla.
     * T-Soft DELETE /orders/order/{id} -> archive (soft delete), DELETE /catalog/products/{id} -> hard delete.
     */
    private interpretDeleteOperation;
    /**
     * Health check yanıtını yorumla.
     * T-Soft'ta dedicated /health endpoint yok — TSoftApiClient `GET /catalog/products?limit=1` ile probe yapıyor.
     */
    private interpretHealthCheck;
    /**
     * Genel yanıt yorumlama.
     */
    private interpretGeneric;
}
//# sourceMappingURL=tsoft.interpreter.d.ts.map