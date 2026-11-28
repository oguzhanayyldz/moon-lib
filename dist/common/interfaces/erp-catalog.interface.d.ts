/**
 * UC-2595 — ERP katalog sözleşmesi (stok/fiyat ÇEKME ortak temeli).
 *
 * Her ERP eşleyicisi (Kolay Bi', Paraşüt, Mikro …) yalnız `listCatalogPage` ile kendi API'sinin
 * bir sayfasını bu biçime çevirir. Sayfalama, stok/fiyat olayına dönüştürme, KDV dönüşümü ve
 * barkod yedeği `ErpIntegration` içinde ORTAKTIR (bkz. `erp-catalog.util.ts`).
 */
/** Depo bazında stok kırılımı (ERP depo kimliği → miktar). */
export interface ErpStockByLocation {
    locationId: string;
    quantity: number;
}
/** ERP'deki bir stok kartı (ürün ya da varyant) — eşleyicinin ürettiği ortak biçim. */
export interface ErpCatalogItem {
    /** ERP'nin kendi ürün kimliği. */
    erpId: string;
    /** Stok kodu (UCMS'te `sku` ile eşleşir). */
    sku: string;
    /** Barkod; boşsa ortak katman SKU'ya düşer (B5). */
    barcode?: string | null;
    name?: string;
    /** Toplam stok (depo kırılımı yoksa ya da "tüm depolar" seçiliyse kullanılır). Yoksa stok yazılmaz. */
    stock?: number | null;
    /** Depo bazında stok; `sourceLocationId` seçiliyse buradan okunur. */
    stockByLocation?: ErpStockByLocation[];
    /** Satış fiyatı; yoksa fiyat yazılmaz. */
    salePrice?: number | null;
    /** `salePrice` KDV dahil mi? false ise `vatRate` ile KDV dahile çevrilir (B6). */
    salePriceVatIncluded: boolean;
    /** KDV oranı (%), ör. 20. Ürünün KENDİ oranı. */
    vatRate?: number | null;
}
/** Sayfa imleci: ERP'ye göre sayfa numarası ya da opak bir dize. */
export type ErpCatalogCursor = string | number;
/** `listCatalogPage` sonucu. `next` yoksa son sayfadır. */
export interface ErpCatalogPage {
    items: ErpCatalogItem[];
    next?: ErpCatalogCursor | null;
}
/** Tek ürün çekme (elle tetiklemede `params.sku/barcode`) için eşleyiciye iletilen süzgeç. */
export interface ErpCatalogQuery {
    sku?: string;
    barcode?: string;
}
/** ERP depo listesi (`fetchLocations`). */
export interface ErpLocation {
    id: string;
    name: string;
}
