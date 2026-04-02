/**
 * Mongoose Update Utilities
 *
 * FOREIGN entity listener'larında optional alanların $unset propagation sorununu çözer.
 *
 * Sorun: Publisher'dan undefined gelen alanlar JSON.stringify'da kaybolur,
 * listener'da .set({field: undefined}) NO-OP olur → eski değer kalır.
 *
 * Çözüm: Publisher undefined → null gönderir, listener null → $unset yapar.
 */

/**
 * updateWithRetry path için: Optional alanların $set/$unset ayrımını yapar.
 *
 * - null → $unset (alan MongoDB'den silinir)
 * - değer var → $set (normal güncelleme)
 * - undefined → atlanır (mevcut değer korunur)
 *
 * @example
 * await OptimisticLockingUtil.updateWithRetry(
 *     Combination, id,
 *     buildSetUnset({
 *         barcode: data.barcode,        // required — her zaman $set
 *         attributes: data.attributes,  // null → $unset, değer → $set
 *         uniqueCode: data.uniqueCode,  // null → $unset, değer → $set
 *     }),
 *     { new: true }
 * );
 */
export function buildSetUnset(fields: Record<string, unknown>): Record<string, unknown> {
    const $set: Record<string, unknown> = {};
    const $unset: Record<string, 1> = {};

    for (const [key, val] of Object.entries(fields)) {
        if (val === null) {
            $unset[key] = 1;
        } else if (val !== undefined) {
            $set[key] = val;
        }
    }

    return {
        $set,
        ...(Object.keys($unset).length > 0 ? { $unset } : {})
    };
}

/**
 * saveWithRetry path için: Mongoose document üzerinde set/unset yapar.
 *
 * - null → field undefined + markModified (Mongoose $unset yapar)
 * - değer var → field set
 * - undefined → atlanır (mevcut değer korunur)
 *
 * @example
 * applyDocumentUpdates(combination, {
 *     barcode: data.barcode,
 *     attributes: data.attributes,
 *     uniqueCode: data.uniqueCode,
 * });
 * await OptimisticLockingUtil.saveWithRetry(combination);
 */
export function applyDocumentUpdates(doc: { set: (key: string, val: unknown) => void; markModified: (key: string) => void }, fields: Record<string, unknown>): void {
    for (const [key, val] of Object.entries(fields)) {
        if (val === null) {
            doc.set(key, undefined);
            doc.markModified(key);
        } else if (val !== undefined) {
            doc.set(key, val);
        }
    }
}
