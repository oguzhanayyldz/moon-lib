import { Subjects } from "./subjects";
import { ResourceName } from "../types/resourceName";
import { IntegrationType } from "../types/integration-type";
import { ProductStockIntegrationUpdated, StockUpdateSettings } from '../interfaces/product-stock-integration-updated.interface';
export interface ProductStockIntegrationUpdatedEvent {
    subject: Subjects.ProductStockIntegrationUpdated;
    data: {
        requestId: string;
        userId: string;
        data: ProductStockIntegrationUpdated[];
        source?: ResourceName;
        /**
         * UC-2595: kaynağın entegrasyon tipi. `Erp` ise inventory açık, faturası ERP'ye geçmemiş sipariş
         * miktarını çekilen stoktan düşer (K-574503 A). Yoksa (pazaryeri/e-ticaret, eski olaylar) düşüm yapılmaz.
         */
        sourceType?: IntegrationType;
        /**
         * UC-2595F ORTA-3: aynı ERP birden çok depoya yazıyorsa her hedef için ayrı olay gider; açık sipariş
         * adedi toplamda YALNIZ BİR kez düşülsün diye ilk (birincil) hedef dışındaki olaylar `true` taşır
         * ve inventory bu olaylarda düşüm yapmaz.
         */
        skipOpenOrderDeduction?: boolean;
        updateConfiguration?: StockUpdateSettings;
        timestamp?: Date;
    };
}
//# sourceMappingURL=product-stock-integration-updated-event.d.ts.map