/**
 * Ürün Durumu (Toplama Süreci)
 * İş paketindeki ürünlerin toplama durumunu belirler
 */
export enum ItemStatus {
    /** Beklemede, henüz toplanmadı */
    Pending = "Pending",
    /** Tamamen toplandı */
    Picked = "Picked",
    /** Kısmen toplandı */
    Partial = "Partial",
    /** Bulunamadı */
    NotFound = "NotFound"
}
