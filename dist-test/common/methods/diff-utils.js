"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deepEqualPlain = deepEqualPlain;
exports.toPlainValue = toPlainValue;
exports.computeEntityDiff = computeEntityDiff;
const mongoose_1 = __importDefault(require("mongoose"));
/**
 * Primitive ve array alanlar icin derin esitlik kontrolu.
 * ObjectId/Date instance'lari string'e cevrilerek karsilastirilir.
 */
function deepEqualPlain(a, b) {
    if (a === b)
        return true;
    if (a == null || b == null)
        return a === b;
    if (a instanceof Date || b instanceof Date) {
        const aTime = a instanceof Date ? a.getTime() : new Date(a).getTime();
        const bTime = b instanceof Date ? b.getTime() : new Date(b).getTime();
        return aTime === bTime;
    }
    if (mongoose_1.default.isValidObjectId(a) && mongoose_1.default.isValidObjectId(b)) {
        return String(a) === String(b);
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length)
            return false;
        return a.every((item, i) => deepEqualPlain(item, b[i]));
    }
    if (typeof a === "object" && typeof b === "object") {
        const aKeys = Object.keys(a);
        const bKeys = Object.keys(b);
        if (aKeys.length !== bKeys.length)
            return false;
        return aKeys.every(k => deepEqualPlain(a[k], b[k]));
    }
    return false;
}
/**
 * Mongoose doc / ObjectId / Date / Map iceren value'yu plain JSON'a cevirir.
 * Audit log diff hesaplamasinda karsilastirma oncesi kullanilir.
 */
function toPlainValue(value) {
    if (value == null)
        return value;
    if (value instanceof mongoose_1.default.Types.ObjectId)
        return value.toString();
    if (value instanceof Date)
        return value.toISOString();
    if (value instanceof Map)
        return Object.fromEntries(value);
    if (Array.isArray(value))
        return value.map(toPlainValue);
    if (typeof value === "object") {
        if (value.toObject) {
            return toPlainValue(value.toObject());
        }
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            if (k.startsWith("$") || k === "__v" || k === "_id")
                continue;
            out[k] = toPlainValue(v);
        }
        return out;
    }
    return value;
}
function computeEntityDiff(previous, current, options) {
    var _a, _b;
    const diff = {};
    const nestedLookup = new Map();
    for (const nested of options.nestedDiffFields || []) {
        nestedLookup.set(nested.parent, nested.excluded || new Set());
    }
    const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
    for (const key of keys) {
        if (options.excludedFields.has(key))
            continue;
        const prevVal = toPlainValue(previous[key]);
        const currVal = toPlainValue(current[key]);
        if (nestedLookup.has(key)) {
            const nestedExcluded = nestedLookup.get(key);
            const prevData = (_a = prevVal) !== null && _a !== void 0 ? _a : {};
            const currData = (_b = currVal) !== null && _b !== void 0 ? _b : {};
            const nestedKeys = new Set([
                ...Object.keys(prevData),
                ...Object.keys(currData)
            ]);
            for (const nk of nestedKeys) {
                if (nestedExcluded.has(nk))
                    continue;
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
//# sourceMappingURL=diff-utils.js.map