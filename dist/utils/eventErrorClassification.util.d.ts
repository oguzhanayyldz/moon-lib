/**
 * Aynı veriyle yeniden denemede de değişmeyecek hatalar: veri/kod kusuru, yeniden teslim yalnız DLQ'yu doldurur (UC-1043).
 * Servis düzeyindeki sınıflamayla aynı liste (shipment `isRetryableOrderError` UC-1023, orders `isRetryableCreationError`
 * UC-1013, invoice UC-1025). Listede olmayan her hata geçicidir: bilinmeyen hatayı kalıcı saymak, yeniden teslimle
 * düzelecek bir olayı kaybettirir.
 */
export declare const DETERMINISTIC_EVENT_ERROR_NAMES: ReadonlySet<string>;
export declare function isDeterministicEventError(error: unknown): boolean;
