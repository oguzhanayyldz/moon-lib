import { Subjects } from "./subjects";
import { ResourceName } from "../types/resourceName";
export interface ProductPriceUpdatedEvent {
    subject: Subjects.ProductPriceUpdated;
    data: {
        requestId: string;
        userId: string;
        list: ProductPriceUpdated[];
        integrationName?: ResourceName;
    };
}
export interface ProductPriceUpdated {
    id: string;
    product: string;
    combination?: string;
    price: number;
    listPrice?: number;
    /**
     * SABIT maliyet — kullanicinin beyan ettigi alis fiyati (issue #683).
     *
     * Orders bunu Product FOREIGN kopyasina yazar ve maliyet katmani BULUNAMAYAN
     * siparislerde kalem maliyeti olarak kullanir (CostSource.Fixed). Katman varsa
     * `OrderProductCostAssigned` bunu ezer — katman daha kesin bir kaynaktir.
     *
     * `Price.averageCost` (fatura ortalamasi) BURAYA KONMAZ: o bilgi amaclidir ve
     * siparis maliyetine girmez (bkz. docs/architecture/maliyet-kurgusu.md).
     */
    costPrice?: number;
    version: number;
    source: ResourceName;
    integrationName?: ResourceName;
    sourceTimestamp: Date;
    updateRequestId?: string;
}
//# sourceMappingURL=product-price-updated-event.d.ts.map