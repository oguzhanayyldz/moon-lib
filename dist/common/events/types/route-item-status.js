"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouteItemStatus = void 0;
/**
 * Rota Öğesi Durumu
 * Toplama rotasındaki her rafın durumunu belirler
 */
var RouteItemStatus;
(function (RouteItemStatus) {
    /** Beklemede, henüz ziyaret edilmedi */
    RouteItemStatus["Pending"] = "Pending";
    /** Bu raftan toplama yapıldı */
    RouteItemStatus["Picked"] = "Picked";
    /** Ürün rafta bulunamadı */
    RouteItemStatus["NotFound"] = "NotFound";
    /** Alternatif rota bulundu, bu raf atlandı */
    RouteItemStatus["Skipped"] = "Skipped";
})(RouteItemStatus || (exports.RouteItemStatus = RouteItemStatus = {}));
