import mongoose from "mongoose";

/**
 * Tek alan icin onceki/simdiki deger ciftini tutan diff kaydi.
 * ProductHistory ve CatalogMappingHistory gibi audit log entity'lerinde kullanilir.
 */
export interface FieldDiff {
    previous: unknown;
    current: unknown;
}

/**
 * Primitive ve array alanlar icin derin esitlik kontrolu.
 * ObjectId/Date instance'lari string'e cevrilerek karsilastirilir.
 */
export function deepEqualPlain(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a == null || b == null) return a === b;

    if (a instanceof Date || b instanceof Date) {
        const aTime = a instanceof Date ? a.getTime() : new Date(a as string).getTime();
        const bTime = b instanceof Date ? b.getTime() : new Date(b as string).getTime();
        return aTime === bTime;
    }

    if (mongoose.isValidObjectId(a) && mongoose.isValidObjectId(b)) {
        return String(a) === String(b);
    }

    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        return a.every((item, i) => deepEqualPlain(item, b[i]));
    }

    if (typeof a === "object" && typeof b === "object") {
        const aKeys = Object.keys(a as Record<string, unknown>);
        const bKeys = Object.keys(b as Record<string, unknown>);
        if (aKeys.length !== bKeys.length) return false;
        return aKeys.every(k =>
            deepEqualPlain((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
        );
    }

    return false;
}

/**
 * Mongoose doc / ObjectId / Date / Map iceren value'yu plain JSON'a cevirir.
 * Audit log diff hesaplamasinda karsilastirma oncesi kullanilir.
 */
export function toPlainValue(value: unknown): unknown {
    if (value == null) return value;
    if (value instanceof mongoose.Types.ObjectId) return value.toString();
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Map) return Object.fromEntries(value as Map<string, unknown>);
    if (Array.isArray(value)) return value.map(toPlainValue);
    if (typeof value === "object") {
        if ((value as { toObject?: () => unknown }).toObject) {
            return toPlainValue((value as { toObject: () => unknown }).toObject());
        }
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            if (k.startsWith("$") || k === "__v" || k === "_id") continue;
            out[k] = toPlainValue(v);
        }
        return out;
    }
    return value;
}

/**
 * Iki obje arasinda alan bazli diff hesaplar.
 * - EXCLUDED_FIELDS icindeki alanlar sonuca dahil edilmez
 * - nestedDiffFields (orn. "integrationData") icindeki objelerin nested key'leri
 *   flat olarak "parent.key" seklinde diff'e girer
 *
 * @param previous Update oncesi snapshot
 * @param current  Update sonrasi snapshot
 * @param options  Haric tutulacak alanlar + nested diff yapilacak alanlar
 */
export interface ComputeEntityDiffOptions {
    excludedFields: Set<string>;
    nestedDiffFields?: Array<{
        parent: string;
        excluded?: Set<string>;
    }>;
}

export function computeEntityDiff(
    previous: Record<string, unknown>,
    current: Record<string, unknown>,
    options: ComputeEntityDiffOptions
): Record<string, FieldDiff> {
    const diff: Record<string, FieldDiff> = {};
    const nestedLookup = new Map<string, Set<string>>();
    for (const nested of options.nestedDiffFields || []) {
        nestedLookup.set(nested.parent, nested.excluded || new Set());
    }

    const keys = new Set<string>([...Object.keys(previous), ...Object.keys(current)]);

    for (const key of keys) {
        if (options.excludedFields.has(key)) continue;

        const prevVal = toPlainValue(previous[key]);
        const currVal = toPlainValue(current[key]);

        if (nestedLookup.has(key)) {
            const nestedExcluded = nestedLookup.get(key)!;
            const prevData = (prevVal as Record<string, unknown>) ?? {};
            const currData = (currVal as Record<string, unknown>) ?? {};
            const nestedKeys = new Set<string>([
                ...Object.keys(prevData),
                ...Object.keys(currData)
            ]);
            for (const nk of nestedKeys) {
                if (nestedExcluded.has(nk)) continue;
                const p = prevData[nk];
                const c = currData[nk];
                if (!deepEqualPlain(p, c)) {
                    diff[`${key}.${nk}`] = { previous: p, current: c };
                }
            }
            continue;
        }

        if (!deepEqualPlain(prevVal, currVal)) {
            diff[key] = { previous: prevVal, current: currVal };
        }
    }

    return diff;
}
