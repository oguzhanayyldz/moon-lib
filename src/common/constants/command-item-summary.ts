/**
 * Toplu entegrasyon komutları için standart kalem özeti (Karar 5 / C).
 *
 * `IntegrationCommandResult.success` "komut koştu mu" anlamında KALIR; kalem düzeyindeki
 * sonuç `result.summary` içinde taşınır. `summary`'yi okumayan tüketici bugünkü davranışını korur.
 *
 * Birim: SKU (platforma gerçekten giden ya da gidemeyen satılabilir birim). HB/Trendyol/N11 başarılı bir
 * parti için tek satır + `itemCount` (gönderilen SKU sayısı), reddedilen kalem için kalem başına satır döner;
 * Amazon tek feed satırı döner, parti SKU sayısı girdiden hesaplanır (bkz. `countCommandInputUnits`).
 * "succeeded" asenkron parti platformlarında "platforma teslim edildi" demektir, parti sonucu değildir.
 */
export interface ItemSummary {
    total: number;
    succeeded: number;
    failed: number;
    /** Gönderilmeden ayıklanan kalemler (ör. fiyat 0). Entegrasyon sağlığını DÜŞÜRMEZ. */
    skipped: number;
}

/**
 * Gönderimi kimin başlattığı. `manual`: kullanıcı butona bastı, D1 uyarısını anında gördü.
 * `background`: cron/olay/zamanlayıcı; kullanıcı ekranda değil, sonuç ancak bildirimle ulaşır.
 */
export type CommandOrigin = 'manual' | 'background';

/**
 * Komutu yayınlayan servisin kendi outbox kaydında sakladığı gönderim bağlamı.
 * Merkezi yönlendirici bu alanı platforma İLETMEZ; yalnız yayınlayan servis sonuçla eşleştirir.
 */
export interface CommandDispatchInfo {
    origin: CommandOrigin;
    /** Gönderim öncesi ayıklananların neden → adet dağılımı (ör. { price: 3 }). */
    skipped?: Record<string, number>;
}

/** `summary` üretilen toplu komutlar */
export const ITEM_SUMMARY_COMMANDS = ['updatePrices', 'updateStocks'] as const;

export function isItemSummaryCommand(command: string): boolean {
    return (ITEM_SUMMARY_COMMANDS as readonly string[]).includes(command);
}

const isCount = (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0;

export function isItemSummary(value: unknown): value is ItemSummary {
    const s = value as ItemSummary;
    return !!s && typeof s === 'object'
        && isCount(s.total) && isCount(s.succeeded) && isCount(s.failed) && isCount(s.skipped)
        && s.total === s.succeeded + s.failed + s.skipped;
}

// Satırın tek bir kalemi temsil ettiğini gösteren alanlar (yoksa satır parti düzeyindedir)
const ITEM_IDENTITY_KEYS = ['sku', 'merchantSku', 'barcode', 'productId', 'externalId', 'variantId', 'id'];

function isRowSucceeded(row: any): boolean {
    if (typeof row?.success === 'boolean') {
        return row.success;
    }
    if (row?.error) {
        return false;
    }
    return typeof row?.status === 'string' ? row.status.toUpperCase() !== 'FAILED' : true;
}

function countSkipped(result: any): number {
    if (isCount(result?.skippedCount)) {
        return result.skippedCount;
    }
    return Array.isArray(result?.skipped) ? result.skipped.length : 0;
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
export function buildItemSummary(result: any, options: { inputCount?: number } = {}): ItemSummary | undefined {
    if (isItemSummary(result?.summary)) {
        return result.summary;
    }

    const rows: any[] | null = Array.isArray(result)
        ? result
        : (Array.isArray(result?.results) ? result.results : null);
    if (!rows) {
        return undefined;
    }

    const skipped = countSkipped(result);
    const batchLevel = isCount(options.inputCount)
        && rows.every(row => !isCount(row?.itemCount) && !ITEM_IDENTITY_KEYS.some(key => row?.[key] !== undefined));

    let succeeded = 0;
    let failed = 0;
    if (batchLevel) {
        const units = Math.max((options.inputCount as number) - skipped, 0);
        if (rows.some(row => !isRowSucceeded(row))) {
            failed = units;
        } else {
            succeeded = units;
        }
    } else {
        for (const row of rows) {
            const weight = isCount(row?.itemCount) && row.itemCount > 0 ? row.itemCount : 1;
            if (isRowSucceeded(row)) {
                succeeded += weight;
            } else {
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
export function countRequestUnits(update: any): number {
    return Array.isArray(update?.variants) && update.variants.length > 0 ? update.variants.length : 1;
}

/**
 * Toplu komut parametrelerinin SKU birimindeki toplamı (`priceUpdates` / `stockUpdates` üzerinden).
 * Toplu komut değilse ya da kalem dizisi yoksa `undefined`.
 */
export function countCommandInputUnits(command: string, params: any): number | undefined {
    if (!isItemSummaryCommand(command)) {
        return undefined;
    }
    const items = command === 'updatePrices' ? params?.priceUpdates : params?.stockUpdates;
    return Array.isArray(items) ? items.reduce((total: number, item: any) => total + countRequestUnits(item), 0) : undefined;
}

/**
 * Toplu komut sonucuna standart `summary` ekler (dinleyici katmanı için).
 * Toplu komut değilse ya da sonuç düz nesne değilse sonuç DEĞİŞMEDEN döner.
 */
export function attachItemSummary<T>(command: string, params: any, result: T): T {
    if (!isItemSummaryCommand(command) || !result || typeof result !== 'object' || Array.isArray(result)) {
        return result;
    }
    const summary = buildItemSummary(result, { inputCount: countCommandInputUnits(command, params) });
    return summary ? { ...result, summary } : result;
}
