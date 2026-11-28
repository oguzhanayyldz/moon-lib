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
         * UC-2595F ORTA-3b: `sourceType: Erp` olayında `data` satırları hedef SIRASIYLA (birincil önce) gelir.
         * inventory açık sipariş adedini ürün başına toplamda bir kez, bu sıraya göre satırlara dağıtır.
         */
        updateConfiguration?: StockUpdateSettings;
        timestamp?: Date;
    };
}
//# sourceMappingURL=product-stock-integration-updated-event.d.ts.map