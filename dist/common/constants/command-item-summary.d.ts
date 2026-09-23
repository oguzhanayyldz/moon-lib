/**
 * Toplu entegrasyon komutları için standart kalem özeti (Karar 5 / C).
 *
 * `IntegrationCommandResult.success` "komut koştu mu" anlamında KALIR; kalem düzeyindeki
 * sonuç `result.summary` içinde taşınır. `summary`'yi okumayan tüketici bugünkü davranışını korur.
 *
 * Birim: platformun sonuç satırı. HB/Trendyol/N11 başarılı bir parti için tek satır + `itemCount`,
 * reddedilen kalem için kalem başına satır döner; Amazon tek feed satırı döner (bkz. `inputCount`).
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
export declare const ITEM_SUMMARY_COMMANDS: readonly ["updatePrices", "updateStocks"];
export declare function isItemSummaryCommand(command: string): boolean;
export declare function isItemSummary(value: unknown): value is ItemSummary;
/**
 * Platform sonucundan `ItemSummary` üretir. Sonuç zaten geçerli `summary` taşıyorsa onu döner.
 *
 * - `{ results: [...] }` ya da dizi sonuç satır satır sayılır; `itemCount` (pozitif tamsayı) satır ağırlığıdır.
 * - Hiçbir satır kalem kimliği ya da `itemCount` taşımıyorsa sonuç PARTİ düzeyindedir (Amazon feed):
 *   `inputCount` verilmişse gönderilen tüm kalemler partinin sonucunu paylaşır.
 * - `skippedCount` / `skipped[]` (ör. Hepsiburada 0 fiyat ayıklaması) `skipped`'e yazılır.
 *
 * Sayılabilir bir şekil yoksa `undefined` döner (tekil komutlar, void sonuç).
 */
export declare function buildItemSummary(result: any, options?: {
    inputCount?: number;
}): ItemSummary | undefined;
/**
 * Toplu komut sonucuna standart `summary` ekler (dinleyici katmanı için).
 * Toplu komut değilse ya da sonuç düz nesne değilse sonuç DEĞİŞMEDEN döner.
 */
export declare function attachItemSummary<T>(command: string, params: any, result: T): T;
