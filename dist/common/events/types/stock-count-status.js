"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStockCountActive = exports.isValidStockCountStatusTransition = exports.STOCK_COUNT_ACTIVE_STATUSES = exports.STOCK_COUNT_STATUS_TRANSITIONS = exports.StockCountFinishReason = exports.StockCountScope = exports.StockCountItemStatus = exports.StockCountStatus = void 0;
/**
 * Stok Sayımı Durumu (issue #637)
 * Sayım oturumunun hangi aşamada olduğunu belirler.
 *
 * NEDEN AYRI ENUM (WorkPackageStatus yeniden kullanılmadı):
 * İş paketi akışı toplama/ayrıştırma/paketleme aşamalarını modelliyor; sayım akışı
 * ise onay + uygulama (finalize) aşamalarını içeriyor. İkisinin geçiş matrisi ortak değil.
 */
var StockCountStatus;
(function (StockCountStatus) {
    /** Sayım kaydı oluşturuldu, snapshot alınmadı (ön koşul kontrolü aşaması) */
    StockCountStatus["Draft"] = "Draft";
    /** Sayım devam ediyor — depo kilidi aktif */
    StockCountStatus["InProgress"] = "InProgress";
    /** Sayım geçici olarak duraklatıldı — kilit HÂLÂ aktif */
    StockCountStatus["Paused"] = "Paused";
    /** Sayım bitti, farklar kullanıcı onayı bekliyor */
    StockCountStatus["PendingApproval"] = "PendingApproval";
    /** Onaylanan farklar stoğa uygulanıyor (idempotent, resume'lu) */
    StockCountStatus["Applying"] = "Applying";
    /** Tamamlandı — kilit kalktı */
    StockCountStatus["Completed"] = "Completed";
    /** Kullanıcı iptal etti — hiçbir stok değişmedi, kilit kalktı */
    StockCountStatus["Cancelled"] = "Cancelled";
    /** Süre aşımı ile cron tarafından kapatıldı — kilit kalktı, sayım verisi korunur */
    StockCountStatus["Expired"] = "Expired";
})(StockCountStatus || (exports.StockCountStatus = StockCountStatus = {}));
/**
 * Sayım satırının durumu
 */
var StockCountItemStatus;
(function (StockCountItemStatus) {
    /** Henüz sayılmadı */
    StockCountItemStatus["NotCounted"] = "NotCounted";
    /** Sayıldı (fark olsun olmasın) */
    StockCountItemStatus["Counted"] = "Counted";
    /** Sistemde olmayan ürün rafta bulundu — yeni stok kaydı açılacak */
    StockCountItemStatus["Extra"] = "Extra";
    /** Sistemde kayıtlı ama rafta bulunamadı (sayılan miktar 0) */
    StockCountItemStatus["Missing"] = "Missing";
})(StockCountItemStatus || (exports.StockCountItemStatus = StockCountItemStatus = {}));
/**
 * Sayım kapsamı
 */
var StockCountScope;
(function (StockCountScope) {
    /** Deponun tamamı sayılır */
    StockCountScope["Warehouse"] = "Warehouse";
    /** Yalnızca seçili raflar sayılır */
    StockCountScope["Shelves"] = "Shelves";
})(StockCountScope || (exports.StockCountScope = StockCountScope = {}));
/**
 * Sayımın bitiş sebebi — StockCountFinished event'i ile taşınır
 */
var StockCountFinishReason;
(function (StockCountFinishReason) {
    StockCountFinishReason["Completed"] = "completed";
    StockCountFinishReason["Cancelled"] = "cancelled";
    StockCountFinishReason["Expired"] = "expired";
})(StockCountFinishReason || (exports.StockCountFinishReason = StockCountFinishReason = {}));
/**
 * Sayım durum geçişleri
 *
 * NOT: Applying durumundan Expired'a geçiş BİLİNÇLİ olarak yok — farklar stoğa
 * uygulanırken cron'un araya girip kilidi kaldırması yarım commit bırakır.
 */
exports.STOCK_COUNT_STATUS_TRANSITIONS = {
    [StockCountStatus.Draft]: [
        StockCountStatus.InProgress,
        StockCountStatus.Cancelled
    ],
    [StockCountStatus.InProgress]: [
        StockCountStatus.Paused,
        StockCountStatus.PendingApproval,
        StockCountStatus.Cancelled,
        StockCountStatus.Expired
    ],
    [StockCountStatus.Paused]: [
        StockCountStatus.InProgress,
        StockCountStatus.Cancelled,
        StockCountStatus.Expired
    ],
    [StockCountStatus.PendingApproval]: [
        StockCountStatus.Applying,
        StockCountStatus.InProgress, // Kullanıcı sayıma geri dönebilir
        StockCountStatus.Cancelled,
        StockCountStatus.Expired
    ],
    [StockCountStatus.Applying]: [
        StockCountStatus.Completed,
        StockCountStatus.PendingApproval // Çakışan satır kaldıysa onaya geri döner
    ],
    [StockCountStatus.Completed]: [],
    [StockCountStatus.Cancelled]: [],
    [StockCountStatus.Expired]: []
};
/**
 * Kilidin aktif kabul edildiği durumlar.
 * Bu kümedeki bir sayım varken ilgili depoda stok mutasyonu ve hesap genelinde
 * sipariş/stok çekme işlemleri durdurulur.
 */
exports.STOCK_COUNT_ACTIVE_STATUSES = [
    StockCountStatus.InProgress,
    StockCountStatus.Paused,
    StockCountStatus.PendingApproval,
    StockCountStatus.Applying
];
/**
 * Durum geçişinin geçerli olup olmadığını kontrol eder
 */
const isValidStockCountStatusTransition = (fromStatus, toStatus) => {
    var _a;
    return ((_a = exports.STOCK_COUNT_STATUS_TRANSITIONS[fromStatus]) === null || _a === void 0 ? void 0 : _a.includes(toStatus)) || false;
};
exports.isValidStockCountStatusTransition = isValidStockCountStatusTransition;
/**
 * Sayımın kilit uygulayan bir durumda olup olmadığını söyler
 */
const isStockCountActive = (status) => {
    return exports.STOCK_COUNT_ACTIVE_STATUSES.includes(status);
};
exports.isStockCountActive = isStockCountActive;
