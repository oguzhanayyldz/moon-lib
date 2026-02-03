/**
 * İş Paketi Aksiyon Tipleri
 * Detaylı loglama için tüm aksiyon türleri
 */
export enum WorkPackageActionType {
    // İş Paketi Aksiyonları
    /** İş paketi oluşturuldu */
    PackageCreated = "PackageCreated",
    /** İş paketi başlatıldı */
    PackageStarted = "PackageStarted",
    /** İş paketi iptal edildi */
    PackageCancelled = "PackageCancelled",
    /** İş paketi tamamlandı */
    PackageCompleted = "PackageCompleted",

    // Personel Aksiyonları
    /** Personel atandı */
    AssigneeChanged = "AssigneeChanged",

    // Araç Aksiyonları
    /** Toplama arabası okutuldu */
    PickingCartScanned = "PickingCartScanned",
    /** Ayrıştırma rafı okutuldu */
    SortingRackScanned = "SortingRackScanned",
    /** Araç serbest bırakıldı */
    DeviceReleased = "DeviceReleased",

    // Toplama Aksiyonları
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

    // Ayrıştırma Aksiyonları
    /** Ayrıştırma başladı */
    SortingStarted = "SortingStarted",
    /** Ürün kutuya yerleştirildi */
    ItemSorted = "ItemSorted",
    /** Ayrıştırma tamamlandı */
    SortingCompleted = "SortingCompleted",

    // Paketleme Aksiyonları
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

    // Sorun Aksiyonları
    /** Sipariş sorunlu işaretlendi */
    OrderMarkedProblematic = "OrderMarkedProblematic",
    /** Sorunlu sipariş çözüldü */
    ProblematicOrderResolved = "ProblematicOrderResolved",

    // Stok Aksiyonları
    /** Stok bloke edildi */
    StockBlocked = "StockBlocked",
    /** Stok serbest bırakıldı */
    StockReleased = "StockReleased",
    /** Stok düşüldü */
    StockDeducted = "StockDeducted",

    // Session Aksiyonları
    /** Session başlatıldı */
    SessionStarted = "SessionStarted",
    /** Session devam etti */
    SessionResumed = "SessionResumed",
    /** Session duraklatıldı */
    SessionPaused = "SessionPaused",
    /** Session zaman aşımı */
    SessionTimeout = "SessionTimeout",

    // Batch Aksiyonları
    /** Batch toplama tamamlandı */
    BatchPickingCompleted = "BatchPickingCompleted",
    /** Batch ayrıştırma tamamlandı */
    BatchSortingCompleted = "BatchSortingCompleted",

    // Performans Aksiyonları
    /** Performans metrikleri kaydedildi */
    PhaseMetricsRecorded = "PhaseMetricsRecorded",

    // Frontend-First Aksiyonları
    /** İlerleme kaydedildi (ara kayıt - sayfa terk edilirken) */
    ProgressSaved = "ProgressSaved",
    /** Slot atandı (ayrıştırma için) */
    SlotAssigned = "SlotAssigned",
    /** Ürün doğrulandı (paketleme için) */
    ItemVerified = "ItemVerified"
}
