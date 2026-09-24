"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTestMode = isTestMode;
/**
 * testMode normalizasyonu (merkezi).
 *
 * `testMode` DB'de credential olarak STRING ("true"/"false") saklanır. `=== false` ya da truthy
 * kontrolleri "false" string'inde yanlış ortama gider.
 *
 * Kural: test ortamı YALNIZ açık `true` / `"true"` / `1` / `"1"` (büyük-küçük harf duyarsız) ile
 * seçilir. Diğer her şey (false, "false", undefined, null, "") → CANLI.
 */
function isTestMode(value) {
    if (value === true || value === 1) {
        return true;
    }
    if (typeof value === 'string') {
        const normalized = value.toLowerCase();
        return normalized === 'true' || normalized === '1';
    }
    return false;
}
