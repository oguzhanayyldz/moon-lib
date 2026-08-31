/**
 * Stok Sayımı Durumu (issue #637)
 * Sayım oturumunun hangi aşamada olduğunu belirler.
 *
 * NEDEN AYRI ENUM (WorkPackageStatus yeniden kullanılmadı):
 * İş paketi akışı toplama/ayrıştırma/paketleme aşamalarını modelliyor; sayım akışı
 * ise onay + uygulama (finalize) aşamalarını içeriyor. İkisinin geçiş matrisi ortak değil.
 */
export declare enum StockCountStatus {
    /** Sayım kaydı oluşturuldu, snapshot alınmadı (ön koşul kontrolü aşaması) */
    Draft = "Draft",
    /** Sayım devam ediyor — depo kilidi aktif */
    InProgress = "InProgress",
    /** Sayım geçici olarak duraklatıldı — kilit HÂLÂ aktif */
    Paused = "Paused",
    /** Sayım bitti, farklar kullanıcı onayı bekliyor */
    PendingApproval = "PendingApproval",
    /** Onaylanan farklar stoğa uygulanıyor (idempotent, resume'lu) */
    Applying = "Applying",
    /** Tamamlandı — kilit kalktı */
    Completed = "Completed",
    /** Kullanıcı iptal etti — hiçbir stok değişmedi, kilit kalktı */
    Cancelled = "Cancelled",
    /** Süre aşımı ile cron tarafından kapatıldı — kilit kalktı, sayım verisi korunur */
    Expired = "Expired"
}
/**
 * Sayım satırının durumu
 */
export declare enum StockCountItemStatus {
    /** Henüz sayılmadı */
    NotCounted = "NotCounted",
    /** Sayıldı (fark olsun olmasın) */
    Counted = "Counted",
    /** Sistemde olmayan ürün rafta bulundu — yeni stok kaydı açılacak */
    Extra = "Extra",
    /** Sistemde kayıtlı ama rafta bulunamadı (sayılan miktar 0) */
    Missing = "Missing"
}
/**
 * Sayım kapsamı
 */
export declare enum StockCountScope {
    /** Deponun tamamı sayılır */
    Warehouse = "Warehouse",
    /** Yalnızca seçili raflar sayılır */
    Shelves = "Shelves"
}
/**
 * Sayımın bitiş sebebi — StockCountFinished event'i ile taşınır
 */
export declare enum StockCountFinishReason {
    Completed = "completed",
    Cancelled = "cancelled",
    Expired = "expired"
}
/**
 * Sayım durum geçişleri
 *
 * NOT: Applying durumundan Expired'a geçiş BİLİNÇLİ olarak yok — farklar stoğa
 * uygulanırken cron'un araya girip kilidi kaldırması yarım commit bırakır.
 */
export declare const STOCK_COUNT_STATUS_TRANSITIONS: Record<StockCountStatus, StockCountStatus[]>;
/**
 * Kilidin aktif kabul edildiği durumlar.
 * Bu kümedeki bir sayım varken ilgili depoda stok mutasyonu ve hesap genelinde
 * sipariş/stok çekme işlemleri durdurulur.
 */
export declare const STOCK_COUNT_ACTIVE_STATUSES: StockCountStatus[];
/**
 * Durum geçişinin geçerli olup olmadığını kontrol eder
 */
export declare const isValidStockCountStatusTransition: (fromStatus: StockCountStatus, toStatus: StockCountStatus) => boolean;
/**
 * Sayımın kilit uygulayan bir durumda olup olmadığını söyler
 */
export declare const isStockCountActive: (status: StockCountStatus) => boolean;
//# sourceMappingURL=stock-count-status.d.ts.map