/**
 * Rota Öğesi Durumu
 * Toplama rotasındaki her rafın durumunu belirler
 */
export enum RouteItemStatus {
    /** Beklemede, henüz ziyaret edilmedi */
    Pending = "Pending",
    /** Bu raftan toplama yapıldı */
    Picked = "Picked",
    /** Ürün rafta bulunamadı */
    NotFound = "NotFound",
    /** Alternatif rota bulundu, bu raf atlandı */
    Skipped = "Skipped"
}
