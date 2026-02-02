/**
 * İş Paketi Sipariş Durumu
 * İş paketi içindeki her siparişin durumunu belirler
 */
export enum WorkPackageOrderStatus {
    /** Beklemede, henüz işlenmedi */
    Pending = "Pending",
    /** Toplama aşamasında */
    Picking = "Picking",
    /** Toplama tamamlandı */
    Picked = "Picked",
    /** Ayrıştırma aşamasında (MultiItem için) */
    Sorting = "Sorting",
    /** Ayrıştırma tamamlandı */
    Sorted = "Sorted",
    /** Paketleme aşamasında */
    Packing = "Packing",
    /** Paketleme tamamlandı */
    Packed = "Packed",
    /** Sorunlu sipariş */
    Problematic = "Problematic"
}

/**
 * Sorunlu sipariş nedenleri
 */
export enum ProblematicReason {
    /** Ürün rafta bulunamadı */
    ItemNotFound = "ItemNotFound",
    /** Stok miktarı uyuşmazlığı */
    StockMismatch = "StockMismatch",
    /** Ürün hasarlı */
    DamagedItem = "DamagedItem",
    /** Barkod okunamıyor */
    BarcodeUnreadable = "BarcodeUnreadable",
    /** Diğer */
    Other = "Other"
}
