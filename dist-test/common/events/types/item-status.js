"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemStatus = void 0;
/**
 * Ürün Durumu (Toplama Süreci)
 * İş paketindeki ürünlerin toplama durumunu belirler
 */
var ItemStatus;
(function (ItemStatus) {
    /** Beklemede, henüz toplanmadı */
    ItemStatus["Pending"] = "Pending";
    /** Tamamen toplandı */
    ItemStatus["Picked"] = "Picked";
    /** Kısmen toplandı */
    ItemStatus["Partial"] = "Partial";
    /** Bulunamadı */
    ItemStatus["NotFound"] = "NotFound";
})(ItemStatus || (exports.ItemStatus = ItemStatus = {}));
//# sourceMappingURL=item-status.js.map