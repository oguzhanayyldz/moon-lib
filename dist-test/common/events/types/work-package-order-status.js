"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProblematicReason = exports.WorkPackageOrderStatus = void 0;
/**
 * İş Paketi Sipariş Durumu
 * İş paketi içindeki her siparişin durumunu belirler
 */
var WorkPackageOrderStatus;
(function (WorkPackageOrderStatus) {
    /** Beklemede, henüz işlenmedi */
    WorkPackageOrderStatus["Pending"] = "Pending";
    /** Toplama aşamasında */
    WorkPackageOrderStatus["Picking"] = "Picking";
    /** Toplama tamamlandı */
    WorkPackageOrderStatus["Picked"] = "Picked";
    /** Ayrıştırma aşamasında (MultiItem için) */
    WorkPackageOrderStatus["Sorting"] = "Sorting";
    /** Ayrıştırma tamamlandı */
    WorkPackageOrderStatus["Sorted"] = "Sorted";
    /** Paketleme aşamasında */
    WorkPackageOrderStatus["Packing"] = "Packing";
    /** Paketleme tamamlandı */
    WorkPackageOrderStatus["Packed"] = "Packed";
    /** Sorunlu sipariş */
    WorkPackageOrderStatus["Problematic"] = "Problematic";
    /** İptal edildi */
    WorkPackageOrderStatus["Cancelled"] = "Cancelled";
})(WorkPackageOrderStatus || (exports.WorkPackageOrderStatus = WorkPackageOrderStatus = {}));
/**
 * Sorunlu sipariş nedenleri
 */
var ProblematicReason;
(function (ProblematicReason) {
    /** Ürün rafta bulunamadı */
    ProblematicReason["ItemNotFound"] = "ItemNotFound";
    /** Stok miktarı uyuşmazlığı */
    ProblematicReason["StockMismatch"] = "StockMismatch";
    /** Ürün hasarlı */
    ProblematicReason["DamagedItem"] = "DamagedItem";
    /** Barkod okunamıyor */
    ProblematicReason["BarcodeUnreadable"] = "BarcodeUnreadable";
    /** Diğer */
    ProblematicReason["Other"] = "Other";
})(ProblematicReason || (exports.ProblematicReason = ProblematicReason = {}));
//# sourceMappingURL=work-package-order-status.js.map