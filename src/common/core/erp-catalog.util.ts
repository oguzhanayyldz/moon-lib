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

const isBlank = (value: unknown): boolean => typeof value !== 'string' || value.trim() === '';

/** 2 ondalığa yuvarlar (kayan nokta kaymasına karşı EPSILON eklenir: 1.005 → 1.01). */
export function roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * B5 — barkod boşsa SKU'ya düşer.
 * inventory `$or: [{barcode}, {sku}]` ile eşler; boş barkod barkodu olmayan RASTGELE bir ürüne eşleşebilirdi.
 */
export function resolveErpBarcode(item: Pick<ErpCatalogItem, 'barcode' | 'sku'>): string {
    return isBlank(item.barcode) ? String(item.sku ?? '').trim() : String(item.barcode).trim();
}

/**
 * B6 — satış fiyatını ürünün KENDİ KDV oranıyla KDV dahile çevirir.
 * - Fiyat yok/geçersiz/≤0 → null (yazılmaz).
 * - KDV dahil → yalnız yuvarlanır.
 * - KDV hariç + oran yok/geçersiz → null: oran bilinmeden yazmak fiyatı %KDV kadar düşük gösterirdi.
 */
export function toVatIncludedPrice(price: number | null | undefined, vatIncluded: boolean, vatRate?: number | null): number | null {
    if (typeof price !== 'number' || !isFinite(price) || price <= 0) return null;
    if (vatIncluded) return roundMoney(price);
    if (typeof vatRate !== 'number' || !isFinite(vatRate) || vatRate < 0) return null;
    return roundMoney(price * (1 + vatRate / 100));
}

/**
 * Bir kaynak hedefi için stok miktarı.
 * - `sourceLocationId` seçiliyse yalnız o deponun miktarı; ERP o depoyu vermiyorsa null (yazılmaz — 0 yazmak stoğu silerdi).
 * - Seçili değilse `stock`; o da yoksa depo kırılımının toplamı.
 * - ERP'de negatif stok ATLANIR (null) — ikas/Shopify kalıbı (`quantity < 0` → satır yazılmaz).
 */
export function resolveErpStockQuantity(item: Pick<ErpCatalogItem, 'stock' | 'stockByLocation'>, sourceLocationId?: string | null): number | null {
    let quantity: number | null | undefined;
    if (!isBlank(sourceLocationId)) {
        const location = item.stockByLocation?.find(l => String(l.locationId) === String(sourceLocationId));
        quantity = location ? location.quantity : null;
    } else if (typeof item.stock === 'number') {
        quantity = item.stock;
    } else if (item.stockByLocation && item.stockByLocation.length > 0) {
        quantity = item.stockByLocation.reduce((sum, l) => sum + (typeof l.quantity === 'number' && isFinite(l.quantity) ? l.quantity : 0), 0);
    }
    if (typeof quantity !== 'number' || !isFinite(quantity)) return null;
    return quantity < 0 ? null : quantity;
}

/** Kalem stok/fiyat eşleştirmesine uygun mu (SKU şart). */
function hasSku(item: ErpCatalogItem): boolean {
    return !isBlank(item.sku);
}

/** Bir sayfanın kalemlerini, bir stok hedefi için `ProductStockIntegrationUpdated` satırlarına çevirir. */
export function buildErpStockRows(items: ErpCatalogItem[], target: ErpStockTarget): ProductStockIntegrationUpdated[] {
    const rows: ProductStockIntegrationUpdated[] = [];
    for (const item of items) {
        if (!hasSku(item)) continue;
        const quantity = resolveErpStockQuantity(item, target.sourceLocationId);
        if (quantity === null) continue;
        // productId/combinationId gönderilmez: ERP kimliği UCMS ObjectId değil; eşleşme sku/barkod ile (ikas deseni).
        rows.push({
            sku: String(item.sku).trim(),
            barcode: resolveErpBarcode(item),
            quantity,
            warehouseId: target.warehouseId,
            ...(target.shelfId ? { shelfId: target.shelfId } : {})
        });
    }
    return rows;
}

/** Bir sayfanın kalemlerini `ProductPriceIntegrationUpdated` satırlarına çevirir (KDV dahil; kural/kur integration'da). */
export function buildErpPriceRows(items: ErpCatalogItem[], platform: ResourceName): ProductPriceIntegrationUpdated[] {
    const rows: ProductPriceIntegrationUpdated[] = [];
    for (const item of items) {
        if (!hasSku(item)) continue;
        const price = toVatIncludedPrice(item.salePrice, item.salePriceVatIncluded, item.vatRate);
        if (price === null) continue;
        rows.push({
            sku: String(item.sku).trim(),
            barcode: resolveErpBarcode(item),
            price,
            source: platform,
            integrationName: platform
        });
    }
    return rows;
}

/** Elle tek ürün çekmede (`params.sku/barcode`) kalem süzgeci; süzgeç yoksa hepsi geçer. */
export function matchesErpQuery(item: Pick<ErpCatalogItem, 'sku' | 'barcode'>, query?: { sku?: string; barcode?: string }): boolean {
    if (!query || (isBlank(query.sku) && isBlank(query.barcode))) return true;
    if (!isBlank(query.sku) && String(item.sku).trim() === String(query.sku).trim()) return true;
    if (!isBlank(query.barcode) && !isBlank(item.barcode) && String(item.barcode).trim() === String(query.barcode).trim()) return true;
    return false;
}
