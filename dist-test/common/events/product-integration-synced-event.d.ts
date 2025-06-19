import { Subjects } from './subjects';
import { ResourceName } from '../types/resourceName';
/**
 * Catalog servisi ile entegrasyonlar arasında ürün eşleştirme için kullanılan basitleştirilmiş ürün verisi
 * @interface ProductSyncedData
 */
export interface ProductSyncedData {
    id: string;
    name: string;
    sku: string;
    barcode?: string;
    code?: string;
    isMainProduct?: boolean;
    listPrice?: number;
    price?: number;
    isFromOurSystem?: boolean;
}
/**
 * @description Entegrasyondan senkronize edilen ürün listesi olayı
 * @interface ProductIntegrationSyncedEvent
 */
export interface ProductIntegrationSyncedEvent {
    subject: Subjects.ProductIntegrationSynced;
    data: {
        source: ResourceName;
        userId: string;
        products: ProductSyncedData[];
        timestamp: Date;
        preserveExistingProducts?: boolean;
        dontDeleteExistingProducts?: boolean;
    };
}
//# sourceMappingURL=product-integration-synced-event.d.ts.map