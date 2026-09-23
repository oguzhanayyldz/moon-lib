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
/**
 * Stok bu platformdan ÇEKİLDİĞİ için (döngüsel akış koruması) gönderilmeyen SKU'ların `skipped[].reason` değeri.
 * Kullanıcının kendi ayarıdır ve her stok çalışmasında tekrar eder: özette `skipped` sayılır, bildirim tetiklemez.
 */
export declare const STOCK_FETCH_MODE_SKIP_REASON = "stock-fetch-mode";
/** `summary` üretilen toplu komutlar */
export declare const ITEM_SUMMARY_COMMANDS: readonly ["updatePrices", "updateStocks"];
export declare function isItemSummaryCommand(command: string): boolean;
export declare function isItemSummary(value: unknown): value is ItemSummary;
/**
 * Platform sonucundan `ItemSummary` üretir. Sonuç zaten geçerli `summary` taşıyorsa onu döner.
 *
 * - `{ results: [...] }` ya da dizi sonuç satır satır sayılır; `itemCount` (pozitif tamsayı) satır ağırlığıdır.
 * - Satırlar kalem kimliği ya da `itemCount` taşımıyorsa sonuç PARTİ düzeyindedir (Amazon feed):
 *   `inputCount` (SKU birimi, bkz. `countCommandInputUnits`) verilmişse gönderilen tüm SKU'lar partinin sonucunu paylaşır.
 *   Boş `results` parti değildir: platform hiçbir şey göndermemiştir, hiçbir birim başarılı SAYILMAZ.
 * - `skippedCount` / `skipped[]` (ör. Hepsiburada 0 fiyat ayıklaması) `skipped`'e yazılır.
 * - `inputCount` verilmişse hiçbir satıra ve atlanana düşmeyen birimler de `skipped`'e yazılır: platforma hiç
 *   ulaşmamışlardır (ör. stok tarafında boş varyant grubu, döngüsel akış koruması), ret görmedikleri için `failed`
 *   değildirler ve entegrasyon sağlığını düşürmezler.
 *
 * Sayılabilir bir şekil yoksa `undefined` döner (tekil komutlar, void sonuç).
 */
export declare function buildItemSummary(result: any, options?: {
    inputCount?: number;
}): ItemSummary | undefined;
/**
 * Bir fiyat/stok güncelleme isteğinin SKU birimindeki büyüklüğü.
 * - `variants` dolu dizi → varyant sayısı (platformlar varyantları ayrı SKU olarak gönderir ve atlar).
 * - `variants` yok → 1 (basit ürün tek SKU).
 * - `variants` BOŞ dizi → 1: platform bu isteği tek bir `no-pushable-variant` kaydıyla atlar; 0 sayılsaydı
 *   atlanan (1) girdiden (0) büyük çıkardı. Ürün satılabilir tek birim olarak gidemedi sayılır.
 */
export declare function countRequestUnits(update: any): number;
/**
 * Toplu komut parametrelerinin SKU birimindeki toplamı (`priceUpdates` / `stockUpdates` üzerinden).
 * Aynı SKU (varyantın ya da basit ürünün `externalId`'si) komutta birden fazla geçse de bir kez sayılır: dört platform
 * da (Amazon, HB, N11, Trendyol) her SKU'yu bir kez gönderir. `externalId`'si olmayan kalem ve boş varyant grubu
 * tekilleştirilmez, her biri bir birimdir (platformlar her birini ayrı atlar).
 * Toplu komut değilse ya da kalem dizisi yoksa `undefined`.
 */
export declare function countCommandInputUnits(command: string, params: any): number | undefined;
/**
 * Toplu komut sonucuna standart `summary` ekler (dinleyici katmanı için).
 * Toplu komut değilse ya da sonuç düz nesne değilse sonuç DEĞİŞMEDEN döner.
 */
export declare function attachItemSummary<T>(command: string, params: any, result: T): T;
