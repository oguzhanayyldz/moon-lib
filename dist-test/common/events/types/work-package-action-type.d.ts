/**
 * İş Paketi Aksiyon Tipleri
 * Detaylı loglama için tüm aksiyon türleri
 */
export declare enum WorkPackageActionType {
    /** İş paketi oluşturuldu */
    PackageCreated = "PackageCreated",
    /** İş paketi başlatıldı */
    PackageStarted = "PackageStarted",
    /** İş paketi iptal edildi */
    PackageCancelled = "PackageCancelled",
    /** İş paketi tamamlandı */
    PackageCompleted = "PackageCompleted",
    /** Personel atandı */
    AssigneeChanged = "AssigneeChanged",
    /** Toplama arabası okutuldu */
    PickingCartScanned = "PickingCartScanned",
    /** Ayrıştırma rafı okutuldu */
    SortingRackScanned = "SortingRackScanned",
    /** Araç serbest bırakıldı */
    DeviceReleased = "DeviceReleased",
    /** Toplama başladı */
    PickingStarted = "PickingStarted",
    /** Ürün toplandı */
    ItemPicked = "ItemPicked",
    /** Ürün bulunamadı */
    ItemNotFound = "ItemNotFound",
    /** Alternatif rota oluşturuldu */
    AlternativeRouteCreated = "AlternativeRouteCreated",
    /** Toplama tamamlandı */
    PickingCompleted = "PickingCompleted",
    /** Ayrıştırma başladı */
    SortingStarted = "SortingStarted",
    /** Ürün kutuya yerleştirildi */
    ItemSorted = "ItemSorted",
    /** Ayrıştırma tamamlandı */
    SortingCompleted = "SortingCompleted",
    /** Paketleme başladı */
    PackingStarted = "PackingStarted",
    /** Sipariş paketlendi */
    OrderPacked = "OrderPacked",
    /** Fatura yazdırıldı */
    InvoicePrinted = "InvoicePrinted",
    /** Kargo etiketi yazdırıldı */
    LabelPrinted = "LabelPrinted",
    /** Paketleme tamamlandı */
    PackingCompleted = "PackingCompleted",
    /** Sipariş sorunlu işaretlendi */
    OrderMarkedProblematic = "OrderMarkedProblematic",
    /** Sorunlu sipariş çözüldü */
    ProblematicOrderResolved = "ProblematicOrderResolved",
    /** Sipariş başka pakete taşındı */
    OrderReassigned = "OrderReassigned",
    /** Sipariş iptal edildi */
    OrderCancelled = "OrderCancelled",
    /** Sipariş güncellendi (kısmi iptal vb.) */
    OrderUpdated = "OrderUpdated",
    /** Stok bloke edildi */
    StockBlocked = "StockBlocked",
    /** Stok blokesi serbest bırakıldı (blockedQuantity azaltıldı) */
    StockBlockedReleased = "StockBlockedReleased",
    /** Stok serbest bırakıldı */
    StockReleased = "StockReleased",
    /** Stok düşüldü */
    StockDeducted = "StockDeducted",
    /** Session başlatıldı */
    SessionStarted = "SessionStarted",
    /** Session devam etti */
    SessionResumed = "SessionResumed",
    /** Session duraklatıldı */
    SessionPaused = "SessionPaused",
    /** Session zaman aşımı */
    SessionTimeout = "SessionTimeout",
    /** Batch toplama tamamlandı */
    BatchPickingCompleted = "BatchPickingCompleted",
    /** Batch ayrıştırma tamamlandı */
    BatchSortingCompleted = "BatchSortingCompleted",
    /** Performans metrikleri kaydedildi */
    PhaseMetricsRecorded = "PhaseMetricsRecorded",
    /** İlerleme kaydedildi (ara kayıt - sayfa terk edilirken) */
    ProgressSaved = "ProgressSaved",
    /** Slot atandı (ayrıştırma için) */
    SlotAssigned = "SlotAssigned",
    /** Ürün doğrulandı (paketleme için) */
    ItemVerified = "ItemVerified"
}
//# sourceMappingURL=work-package-action-type.d.ts.map