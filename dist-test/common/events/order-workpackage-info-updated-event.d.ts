import { Subjects } from "./subjects";
/**
 * WorkPackageInfo - Sipariş üzerinde tutulan iş paketi özet bilgisi
 * Orders servisinde Order.workPackageInfo olarak saklanır
 */
export interface WorkPackageInfo {
    workPackageId: string;
    packageNumber: string;
    packageType: string;
    status: string;
    warehouseId?: string;
    warehouseName?: string;
    assignedAt?: Date;
    pickedAt?: Date;
    sortedAt?: Date;
    packedAt?: Date;
    completedAt?: Date;
    isProblematic?: boolean;
    problematicReason?: string;
}
/**
 * Tek bir sipariş güncellemesi
 */
export interface OrderWorkPackageInfoUpdate {
    orderId: string;
    orderUuid: string;
    version: number;
    workPackageInfo: WorkPackageInfo;
    previousStatus?: string;
}
/**
 * OrderWorkPackageInfoBulkUpdatedEvent
 *
 * Inventory servisinden Orders servisine BULK olarak gönderilir.
 * İş paketi durum geçişlerinde tüm siparişler için tek event:
 * - İş paketi oluşturulduğunda (tüm siparişler Pending)
 * - Toplama tamamlandığında (tüm siparişler Picked)
 * - Ayrıştırma tamamlandığında (tüm siparişler Sorted)
 * - Paketleme tamamlandığında (tüm siparişler Packed)
 * - İş paketi iptal edildiğinde (tüm siparişler Cancelled)
 *
 * Avantajları:
 * - 10 sipariş = 1 event (10 event yerine)
 * - Daha az NATS trafiği
 * - Orders servisinde tek transaction ile güncelleme
 */
export interface OrderWorkPackageInfoBulkUpdatedEvent {
    subject: Subjects.OrderWorkPackageInfoBulkUpdated;
    data: {
        user: string;
        workPackageId: string;
        packageNumber: string;
        updates: OrderWorkPackageInfoUpdate[];
        batchId: string;
        batchSize: number;
        updatedAt: Date;
    };
}
//# sourceMappingURL=order-workpackage-info-updated-event.d.ts.map