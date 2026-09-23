"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ITEM_SUMMARY_COMMANDS = void 0;
exports.isItemSummaryCommand = isItemSummaryCommand;
exports.isItemSummary = isItemSummary;
exports.buildItemSummary = buildItemSummary;
exports.countRequestUnits = countRequestUnits;
exports.countCommandInputUnits = countCommandInputUnits;
exports.attachItemSummary = attachItemSummary;
/** `summary` üretilen toplu komutlar */
exports.ITEM_SUMMARY_COMMANDS = ['updatePrices', 'updateStocks'];
function isItemSummaryCommand(command) {
    return exports.ITEM_SUMMARY_COMMANDS.includes(command);
}
const isCount = (value) => typeof value === 'number' && Number.isInteger(value) && value >= 0;
function isItemSummary(value) {
    const s = value;
    return !!s && typeof s === 'object'
        && isCount(s.total) && isCount(s.succeeded) && isCount(s.failed) && isCount(s.skipped)
        && s.total === s.succeeded + s.failed + s.skipped;
}
// Satırın tek bir kalemi temsil ettiğini gösteren alanlar (yoksa satır parti düzeyindedir)
const ITEM_IDENTITY_KEYS = ['sku', 'merchantSku', 'barcode', 'productId', 'externalId', 'variantId', 'id'];
function isRowSucceeded(row) {
    if (typeof (row === null || row === void 0 ? void 0 : row.success) === 'boolean') {
        return row.success;
    }
    if (row === null || row === void 0 ? void 0 : row.error) {
        return false;
    }
    return typeof (row === null || row === void 0 ? void 0 : row.status) === 'string' ? row.status.toUpperCase() !== 'FAILED' : true;
}
function countSkipped(result) {
    if (isCount(result === null || result === void 0 ? void 0 : result.skippedCount)) {
        return result.skippedCount;
    }
    return Array.isArray(result === null || result === void 0 ? void 0 : result.skipped) ? result.skipped.length : 0;
}
/**
 * Platform sonucundan `ItemSummary` üretir. Sonuç zaten geçerli `summary` taşıyorsa onu döner.
 *
 * - `{ results: [...] }` ya da dizi sonuç satır satır sayılır; `itemCount` (pozitif tamsayı) satır ağırlığıdır.
 * - Hiçbir satır kalem kimliği ya da `itemCount` taşımıyorsa sonuç PARTİ düzeyindedir (Amazon feed):
 *   `inputCount` (SKU birimi, bkz. `countCommandInputUnits`) verilmişse gönderilen tüm SKU'lar partinin sonucunu paylaşır.
 * - `skippedCount` / `skipped[]` (ör. Hepsiburada 0 fiyat ayıklaması) `skipped`'e yazılır.
 *
 * Sayılabilir bir şekil yoksa `undefined` döner (tekil komutlar, void sonuç).
 */
function buildItemSummary(result, options = {}) {
    if (isItemSummary(result === null || result === void 0 ? void 0 : result.summary)) {
        return result.summary;
    }
    const rows = Array.isArray(result)
        ? result
        : (Array.isArray(result === null || result === void 0 ? void 0 : result.results) ? result.results : null);
    if (!rows) {
        return undefined;
    }
    const skipped = countSkipped(result);
    const batchLevel = isCount(options.inputCount)
        && rows.every(row => !isCount(row === null || row === void 0 ? void 0 : row.itemCount) && !ITEM_IDENTITY_KEYS.some(key => (row === null || row === void 0 ? void 0 : row[key]) !== undefined));
    let succeeded = 0;
    let failed = 0;
    if (batchLevel) {
        const units = Math.max(options.inputCount - skipped, 0);
        if (rows.some(row => !isRowSucceeded(row))) {
            failed = units;
        }
        else {
            succeeded = units;
        }
    }
    else {
        for (const row of rows) {
            const weight = isCount(row === null || row === void 0 ? void 0 : row.itemCount) && row.itemCount > 0 ? row.itemCount : 1;
            if (isRowSucceeded(row)) {
                succeeded += weight;
            }
            else {
                failed += weight;
            }
        }
    }
    return { total: succeeded + failed + skipped, succeeded, failed, skipped };
}
/**
 * Bir fiyat/stok güncelleme isteğinin SKU birimindeki büyüklüğü.
 * - `variants` dolu dizi → varyant sayısı (platformlar varyantları ayrı SKU olarak gönderir ve atlar).
 * - `variants` yok → 1 (basit ürün tek SKU).
 * - `variants` BOŞ dizi → 1: platform bu isteği tek bir `no-pushable-variant` kaydıyla atlar; 0 sayılsaydı
 *   atlanan (1) girdiden (0) büyük çıkardı. Ürün satılabilir tek birim olarak gidemedi sayılır.
 */
function countRequestUnits(update) {
    return Array.isArray(update === null || update === void 0 ? void 0 : update.variants) && update.variants.length > 0 ? update.variants.length : 1;
}
/**
 * Toplu komut parametrelerinin SKU birimindeki toplamı (`priceUpdates` / `stockUpdates` üzerinden).
 * Toplu komut değilse ya da kalem dizisi yoksa `undefined`.
 */
function countCommandInputUnits(command, params) {
    if (!isItemSummaryCommand(command)) {
        return undefined;
    }
    const items = command === 'updatePrices' ? params === null || params === void 0 ? void 0 : params.priceUpdates : params === null || params === void 0 ? void 0 : params.stockUpdates;
    return Array.isArray(items) ? items.reduce((total, item) => total + countRequestUnits(item), 0) : undefined;
}
/**
 * Toplu komut sonucuna standart `summary` ekler (dinleyici katmanı için).
 * Toplu komut değilse ya da sonuç düz nesne değilse sonuç DEĞİŞMEDEN döner.
 */
function attachItemSummary(command, params, result) {
    if (!isItemSummaryCommand(command) || !result || typeof result !== 'object' || Array.isArray(result)) {
        return result;
    }
    const summary = buildItemSummary(result, { inputCount: countCommandInputUnits(command, params) });
    return summary ? Object.assign(Object.assign({}, result), { summary }) : result;
}
