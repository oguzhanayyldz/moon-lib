/**
 * Rota Öğesi Durumu
 * Toplama rotasındaki her rafın durumunu belirler
 */
export declare enum RouteItemStatus {
    /** Beklemede, henüz ziyaret edilmedi */
    Pending = "Pending",
    /** Bu raftan toplama yapıldı */
    Picked = "Picked",
    /** Ürün rafta bulunamadı */
    NotFound = "NotFound",
    /** Alternatif rota bulundu, bu raf atlandı */
    Skipped = "Skipped"
}
//# sourceMappingURL=route-item-status.d.ts.map