"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateBrandContentHash = calculateBrandContentHash;
exports.calculateCategoryContentHash = calculateCategoryContentHash;
const crypto_1 = __importDefault(require("crypto"));
/**
 * Brand verisinin content hash'ini hesaplar.
 * Delta sync için kullanılır - hash değişmemişse veri değişmemiştir.
 */
function calculateBrandContentHash(data) {
    const hashInput = JSON.stringify({
        name: data.name,
        code: data.code || '',
        // metadata'yı sıralı key'lerle serialize et (deterministik hash için)
        metadata: data.metadata ? sortObject(data.metadata) : {}
    });
    return crypto_1.default.createHash('md5').update(hashInput).digest('hex');
}
/**
 * Category verisinin content hash'ini hesaplar.
 * Delta sync için kullanılır - hash değişmemişse veri değişmemiştir.
 */
function calculateCategoryContentHash(data) {
    var _a, _b, _c, _d, _e;
    const hashInput = JSON.stringify({
        name: data.name,
        parentId: data.parentId || '',
        level: (_a = data.level) !== null && _a !== void 0 ? _a : 0,
        isLeaf: (_b = data.isLeaf) !== null && _b !== void 0 ? _b : false,
        // metadata'dan sadece önemli alanları al
        path: ((_c = data.metadata) === null || _c === void 0 ? void 0 : _c.path) || '',
        displayOrder: (_e = (_d = data.metadata) === null || _d === void 0 ? void 0 : _d.displayOrder) !== null && _e !== void 0 ? _e : 0
    });
    return crypto_1.default.createHash('md5').update(hashInput).digest('hex');
}
/**
 * Object'i key'lere göre sıralar (deterministik JSON stringify için).
 * Nested object'ler için recursive çalışır.
 */
function sortObject(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => sortObject(item));
    }
    const sorted = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
        sorted[key] = sortObject(obj[key]);
    }
    return sorted;
}
//# sourceMappingURL=contentHash.js.map