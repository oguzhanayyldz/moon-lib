import { ErpCatalogItem } from "../interfaces/erp-catalog.interface";
import { ProductStockIntegrationUpdated } from "../interfaces/product-stock-integration-updated.interface";
import { ProductPriceIntegrationUpdated } from "../interfaces/product-price-integration-updated.interface";
import { ResourceName } from "../types/resourceName";
/**
 * UC-2595 — ERP katalog kalemini stok/fiyat olayı satırına çeviren SAF yardımcılar.
 * Ağ, veritabanı ya da saat kullanmaz; her ERP eşleyicisi için aynı kural geçerlidir.
 */
/** Stok olayı için hedef (kullanıcının `stock_update_settings.sources[]` kaydından). */
export interface ErpStockTarget {
    warehouseId: string;
    shelfId?: string | null;
    /** ERP tarafındaki depo; null/boş = tüm depoların toplamı. */
    sourceLocationId?: string | null;
}
/** 2 ondalığa yuvarlar (kayan nokta kaymasına karşı EPSILON eklenir: 1.005 → 1.01). */
export declare function roundMoney(value: number): number;
/**
 * B5 — barkod boşsa SKU'ya düşer.
 * inventory `$or: [{barcode}, {sku}]` ile eşler; boş barkod barkodu olmayan RASTGELE bir ürüne eşleşebilirdi.
 */
export declare function resolveErpBarcode(item: Pick<ErpCatalogItem, 'barcode' | 'sku'>): string;
/**
 * B6 — satış fiyatını ürünün KENDİ KDV oranıyla KDV dahile çevirir.
 * - Fiyat yok/geçersiz/≤0 → null (yazılmaz).
 * - KDV dahil → yalnız yuvarlanır.
 * - KDV hariç + oran yok/geçersiz → null: oran bilinmeden yazmak fiyatı %KDV kadar düşük gösterirdi.
 */
export declare function toVatIncludedPrice(price: number | null | undefined, vatIncluded: boolean, vatRate?: number | null): number | null;
/**
 * Bir kaynak hedefi için stok miktarı.
 * - `sourceLocationId` seçiliyse yalnız o deponun miktarı; ERP o depoyu vermiyorsa 0 (ikas/Shopify kalıbı: sıfır stoklu depo kalemini listelemeyen ERP'de eski stok kalmasın).
 * - Seçili değilse `stock`; o da yoksa depo kırılımının toplamı.
 * - Negatif stok OLDUĞU GİBİ döner (UC-2628, K-574514 A): "eksi stok 0 yazılır" kuralı tüm kaynaklar için
 *   TEK yerde, inventory `ProductStockIntegrationUpdated` dinleyicisinde uygulanır. Burada atlamak Moon'da eski
 *   stoğu bırakıyordu (ERP 5 → -2 olunca Moon 5 kalıyor, pazaryerine 5 gidiyordu).
 * - Stok alanı yoksa/geçersizse null (yazılmaz) — değişmedi.
 */
export declare function resolveErpStockQuantity(item: Pick<ErpCatalogItem, 'stock' | 'stockByLocation'>, sourceLocationId?: string | null): number | null;
/** Bir sayfanın kalemlerini, bir stok hedefi için `ProductStockIntegrationUpdated` satırlarına çevirir. */
export declare function buildErpStockRows(items: ErpCatalogItem[], target: ErpStockTarget): ProductStockIntegrationUpdated[];
/** Bir sayfanın kalemlerini `ProductPriceIntegrationUpdated` satırlarına çevirir (KDV dahil; kural/kur integration'da). */
export declare function buildErpPriceRows(items: ErpCatalogItem[], platform: ResourceName): ProductPriceIntegrationUpdated[];
/** Elle tek ürün çekmede (`params.sku/barcode`) kalem süzgeci; süzgeç yoksa hepsi geçer. */
export declare function matchesErpQuery(item: Pick<ErpCatalogItem, 'sku' | 'barcode'>, query?: {
    sku?: string;
    barcode?: string;
}): boolean;
