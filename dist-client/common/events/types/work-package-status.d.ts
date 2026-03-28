/**
 * İş Paketi Durumu
 * İş paketinin hangi aşamada olduğunu belirler
 */
export declare enum WorkPackageStatus {
    /** İş paketi oluşturuldu, henüz başlamadı */
    Created = "Created",
    /** Toplama aşamasında */
    Picking = "Picking",
    /** Toplama tamamlandı */
    Picked = "Picked",
    /** Ayrıştırma aşamasında (sadece MultiItem için) */
    Sorting = "Sorting",
    /** Ayrıştırma tamamlandı (sadece MultiItem için) */
    Sorted = "Sorted",
    /** Paketleme aşamasında */
    Packing = "Packing",
    /** Tamamlandı */
    Completed = "Completed",
    /** İptal edildi */
    Cancelled = "Cancelled"
}
/**
 * İş paketi durum geçişleri
 */
export declare const WORK_PACKAGE_STATUS_TRANSITIONS: Record<WorkPackageStatus, WorkPackageStatus[]>;
/**
 * Durum geçişinin geçerli olup olmadığını kontrol eder
 */
export declare const isValidWorkPackageStatusTransition: (fromStatus: WorkPackageStatus, toStatus: WorkPackageStatus) => boolean;
