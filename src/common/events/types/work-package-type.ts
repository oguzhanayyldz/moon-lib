/**
 * İş Paketi Tipi
 * Tekli veya çoklu sipariş işleme türünü belirler
 */
export enum WorkPackageType {
    /** Tek ürünlü siparişler - Toplama → Paketleme */
    SingleItem = "SingleItem",
    /** Çok ürünlü siparişler - Toplama → Ayrıştırma → Paketleme */
    MultiItem = "MultiItem"
}
