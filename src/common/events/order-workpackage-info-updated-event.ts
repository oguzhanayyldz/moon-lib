import { Subjects } from "./subjects";

/**
 * WorkPackageInfo - Sipariş üzerinde tutulan iş paketi özet bilgisi
 * Orders servisinde Order.workPackageInfo olarak saklanır
 */
export interface WorkPackageInfo {
    workPackageId: string;
    packageNumber: string;
    packageType: string;           // SingleItem | MultiItem
    status: string;                // Pending | Picking | Picked | Sorting | Sorted | Packing | Packed | Problematic | Cancelled
    warehouseId?: string;
    warehouseName?: string;
    assignedAt?: Date;             // İş paketine eklenme tarihi
    pickedAt?: Date;               // Toplama tamamlanma
    sortedAt?: Date;               // Ayrıştırma tamamlanma (çoklu için)
    packedAt?: Date;               // Paketleme tamamlanma
    completedAt?: Date;            // İş paketi tamamlanma
    isProblematic?: boolean;       // Sorunlu sipariş mi
    problematicReason?: string;    // Sorun sebebi
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
