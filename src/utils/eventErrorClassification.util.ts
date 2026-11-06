/**
 * Aynı veriyle yeniden denemede de değişmeyecek hatalar: veri/kod kusuru, yeniden teslim yalnız DLQ'yu doldurur (UC-1043).
 * Servis düzeyindeki sınıflamayla aynı liste (shipment `isRetryableOrderError` UC-1023, orders `isRetryableCreationError`
 * UC-1013, invoice UC-1025). Listede olmayan her hata geçicidir: bilinmeyen hatayı kalıcı saymak, yeniden teslimle
 * düzelecek bir olayı kaybettirir.
 */
export const DETERMINISTIC_EVENT_ERROR_NAMES: ReadonlySet<string> = new Set<string>([
    'ValidationError', 'CastError', 'StrictModeError', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError'
]);

export function isDeterministicEventError(error: unknown): boolean {
    const name = (error as { name?: unknown } | null | undefined)?.name;
    return typeof name === 'string' && DETERMINISTIC_EVENT_ERROR_NAMES.has(name);
}
