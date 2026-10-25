"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DETERMINISTIC_EVENT_ERROR_NAMES = void 0;
exports.isDeterministicEventError = isDeterministicEventError;
/**
 * Aynı veriyle yeniden denemede de değişmeyecek hatalar: veri/kod kusuru, yeniden teslim yalnız DLQ'yu doldurur (UC-1043).
 * Servis düzeyindeki sınıflamayla aynı liste (shipment `isRetryableOrderError` UC-1023, orders `isRetryableCreationError`
 * UC-1013, invoice UC-1025). Listede olmayan her hata geçicidir: bilinmeyen hatayı kalıcı saymak, yeniden teslimle
 * düzelecek bir olayı kaybettirir.
 */
exports.DETERMINISTIC_EVENT_ERROR_NAMES = new Set([
    'ValidationError', 'CastError', 'StrictModeError', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError'
]);
function isDeterministicEventError(error) {
    const name = error === null || error === void 0 ? void 0 : error.name;
    return typeof name === 'string' && exports.DETERMINISTIC_EVENT_ERROR_NAMES.has(name);
}
//# sourceMappingURL=eventErrorClassification.util.js.map