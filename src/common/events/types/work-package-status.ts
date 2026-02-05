/**
 * İş Paketi Durumu
 * İş paketinin hangi aşamada olduğunu belirler
 */
export enum WorkPackageStatus {
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
export const WORK_PACKAGE_STATUS_TRANSITIONS: Record<WorkPackageStatus, WorkPackageStatus[]> = {
    [WorkPackageStatus.Created]: [
        WorkPackageStatus.Picking,
        WorkPackageStatus.Cancelled
    ],
    [WorkPackageStatus.Picking]: [
        WorkPackageStatus.Picked,   // Toplama tamamlandı
        WorkPackageStatus.Sorting,  // MultiItem için direkt ayrıştırmaya
        WorkPackageStatus.Packing,  // SingleItem için direkt paketlemeye
        WorkPackageStatus.Cancelled
    ],
    [WorkPackageStatus.Picked]: [
        WorkPackageStatus.Sorting,  // MultiItem için ayrıştırmaya
        WorkPackageStatus.Packing,  // SingleItem için paketlemeye
        WorkPackageStatus.Cancelled
    ],
    [WorkPackageStatus.Sorting]: [
        WorkPackageStatus.Sorted,   // Ayrıştırma tamamlandı
        WorkPackageStatus.Packing,
        WorkPackageStatus.Cancelled
    ],
    [WorkPackageStatus.Sorted]: [
        WorkPackageStatus.Packing,
        WorkPackageStatus.Cancelled
    ],
    [WorkPackageStatus.Packing]: [
        WorkPackageStatus.Completed,
        WorkPackageStatus.Cancelled
    ],
    [WorkPackageStatus.Completed]: [],
    [WorkPackageStatus.Cancelled]: []
};

/**
 * Durum geçişinin geçerli olup olmadığını kontrol eder
 */
export const isValidWorkPackageStatusTransition = (
    fromStatus: WorkPackageStatus,
    toStatus: WorkPackageStatus
): boolean => {
    return WORK_PACKAGE_STATUS_TRANSITIONS[fromStatus]?.includes(toStatus) || false;
};
