"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roundMoney = roundMoney;
exports.resolveErpBarcode = resolveErpBarcode;
exports.toVatIncludedPrice = toVatIncludedPrice;
exports.resolveErpStockQuantity = resolveErpStockQuantity;
exports.buildErpStockRows = buildErpStockRows;
exports.buildErpPriceRows = buildErpPriceRows;
exports.matchesErpQuery = matchesErpQuery;
const isBlank = (value) => typeof value !== 'string' || value.trim() === '';
/** 2 ondalığa yuvarlar (kayan nokta kaymasına karşı EPSILON eklenir: 1.005 → 1.01). */
function roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
/**
 * B5 — barkod boşsa SKU'ya düşer.
 * inventory `$or: [{barcode}, {sku}]` ile eşler; boş barkod barkodu olmayan RASTGELE bir ürüne eşleşebilirdi.
 */
function resolveErpBarcode(item) {
    var _a;
    return isBlank(item.barcode) ? String((_a = item.sku) !== null && _a !== void 0 ? _a : '').trim() : String(item.barcode).trim();
}
/**
 * B6 — satış fiyatını ürünün KENDİ KDV oranıyla KDV dahile çevirir.
 * - Fiyat yok/geçersiz/≤0 → null (yazılmaz).
 * - KDV dahil → yalnız yuvarlanır.
 * - KDV hariç + oran yok/geçersiz → null: oran bilinmeden yazmak fiyatı %KDV kadar düşük gösterirdi.
 */
function toVatIncludedPrice(price, vatIncluded, vatRate) {
    if (typeof price !== 'number' || !isFinite(price) || price <= 0)
        return null;
    if (vatIncluded)
        return roundMoney(price);
    if (typeof vatRate !== 'number' || !isFinite(vatRate) || vatRate < 0)
        return null;
    return roundMoney(price * (1 + vatRate / 100));
}
/**
 * Bir kaynak hedefi için stok miktarı.
 * - `sourceLocationId` seçiliyse yalnız o deponun miktarı; ERP o depoyu vermiyorsa null (yazılmaz — 0 yazmak stoğu silerdi).
 * - Seçili değilse `stock`; o da yoksa depo kırılımının toplamı.
 * - ERP'de negatif stok (fazla satış) 0'a çekilir.
 */
function resolveErpStockQuantity(item, sourceLocationId) {
    var _a;
    let quantity;
    if (!isBlank(sourceLocationId)) {
        const location = (_a = item.stockByLocation) === null || _a === void 0 ? void 0 : _a.find(l => String(l.locationId) === String(sourceLocationId));
        quantity = location ? location.quantity : null;
    }
    else if (typeof item.stock === 'number') {
        quantity = item.stock;
    }
    else if (item.stockByLocation && item.stockByLocation.length > 0) {
        quantity = item.stockByLocation.reduce((sum, l) => sum + (typeof l.quantity === 'number' && isFinite(l.quantity) ? l.quantity : 0), 0);
    }
    if (typeof quantity !== 'number' || !isFinite(quantity))
        return null;
    return quantity < 0 ? 0 : quantity;
}
/** Kalem stok/fiyat eşleştirmesine uygun mu (SKU şart). */
function hasSku(item) {
    return !isBlank(item.sku);
}
/** Bir sayfanın kalemlerini, bir stok hedefi için `ProductStockIntegrationUpdated` satırlarına çevirir. */
function buildErpStockRows(items, target) {
    const rows = [];
    for (const item of items) {
        if (!hasSku(item))
            continue;
        const quantity = resolveErpStockQuantity(item, target.sourceLocationId);
        if (quantity === null)
            continue;
        // productId/combinationId gönderilmez: ERP kimliği UCMS ObjectId değil; eşleşme sku/barkod ile (ikas deseni).
        rows.push(Object.assign({ sku: String(item.sku).trim(), barcode: resolveErpBarcode(item), quantity, warehouseId: target.warehouseId }, (target.shelfId ? { shelfId: target.shelfId } : {})));
    }
    return rows;
}
/** Bir sayfanın kalemlerini HAM fiyat satırlarına çevirir (KDV dahil; kural/kur integration'da). */
function buildErpPriceRows(items, platform) {
    const rows = [];
    for (const item of items) {
        if (!hasSku(item))
            continue;
        const price = toVatIncludedPrice(item.salePrice, item.salePriceVatIncluded, item.vatRate);
        if (price === null)
            continue;
        rows.push({
            sku: String(item.sku).trim(),
            barcode: resolveErpBarcode(item),
            price,
            currency: isBlank(item.currency) ? null : String(item.currency).trim().toUpperCase(),
            source: platform,
            integrationName: platform
        });
    }
    return rows;
}
/** Elle tek ürün çekmede (`params.sku/barcode`) kalem süzgeci; süzgeç yoksa hepsi geçer. */
function matchesErpQuery(item, query) {
    if (!query || (isBlank(query.sku) && isBlank(query.barcode)))
        return true;
    if (!isBlank(query.sku) && String(item.sku).trim() === String(query.sku).trim())
        return true;
    if (!isBlank(query.barcode) && !isBlank(item.barcode) && String(item.barcode).trim() === String(query.barcode).trim())
        return true;
    return false;
}
//# sourceMappingURL=erp-catalog.util.js.map