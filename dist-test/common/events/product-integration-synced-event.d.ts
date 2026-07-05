import { Subjects } from './subjects';
import { ResourceName } from '../types/resourceName';
import { IntegrationStatus } from '../types/integration-status';
/**
 * Ürünün pazaryerindeki onay durumu (matchProducts producer'ları raporlar).
 * - 'approved': pazaryeri onayladı, satışta → CatalogMapping IntegrationStatus.Active
 * - 'pending':  gönderildi/eşleşti ama onay bekliyor → IntegrationStatus.PendingApproval
 * - 'rejected': pazaryeri reddetti → IntegrationStatus.Failed
 * Alan opsiyoneldir; producer göndermezse listener eski davranışı korur (Active).
 */
export type ProductApprovalStatus = 'approved' | 'pending' | 'rejected';
/**
 * Pazaryeri onay durumunu (approvalStatus) CatalogMapping integrationData.status'üne çevirir.
 * Catalog listener'ları (matchProducts, productCreated) tek kaynaktan kullanır.
 * Alan gelmezse (producer sinyal göndermediyse) eski davranış korunur: Active → tam geriye uyumlu.
 * - 'pending'  → PendingApproval (gönderildi, pazaryeri onayı bekliyor — matchProducts eşleşmeye DEVAM eder)
 * - 'rejected' → Failed
 * - 'approved'/undefined → Active
 */
export declare function resolveIntegrationStatusFromApproval(approvalStatus?: ProductApprovalStatus): IntegrationStatus;
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
    variantId?: string;
    approvalStatus?: ProductApprovalStatus;
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