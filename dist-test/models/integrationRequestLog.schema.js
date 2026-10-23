"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.INTEGRATION_REQUEST_LOG_TTL_SECONDS = void 0;
exports.createIntegrationRequestLogModel = createIntegrationRequestLogModel;
exports.ensureIntegrationRequestLogTtlIndex = ensureIntegrationRequestLogTtlIndex;
const mongoose_1 = __importDefault(require("mongoose"));
const common_1 = require("../common");
const operation_type_enum_1 = require("../enums/operation-type.enum");
const base_schema_1 = require("./base/base.schema");
/**
 * İstek loglarının üst saklama süresi (UC-962): 7 gün, `requestTime` TTL indeksiyle.
 * UC-979 Faz 1: asıl süre `expireAt` (başarı 3 / hata 14 gün); bu TTL güvenlik ağı olarak kalır ve
 * expireAt'siz eski belgeleri siler. Faz 2 (ayrı PR) bu değeri 14 güne çeker — ön koşullar sonuç raporunda.
 */
exports.INTEGRATION_REQUEST_LOG_TTL_SECONDS = 7 * 24 * 60 * 60;
const integrationRequestLogSchemaDefinition = {
    integrationName: {
        type: String,
        required: true,
        enum: Object.values(common_1.ResourceName)
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    operationType: {
        type: String,
        required: false, // Eski kayıtlar için nullable
        enum: Object.values(operation_type_enum_1.OperationType),
        index: true
    },
    method: {
        type: String,
        required: true,
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
    },
    endpoint: {
        type: String,
        required: true
    },
    requestHeaders: {
        type: mongoose_1.default.Schema.Types.Mixed
    },
    requestBody: {
        type: mongoose_1.default.Schema.Types.Mixed
    },
    responseStatus: {
        type: Number
    },
    responseHeaders: {
        type: mongoose_1.default.Schema.Types.Mixed
    },
    responseBody: {
        type: mongoose_1.default.Schema.Types.Mixed
    },
    interpretedResponse: {
        type: {
            summary: { type: String, required: true },
            success: { type: Boolean, required: true },
            successCount: { type: Number, required: false },
            failureCount: { type: Number, required: false },
            details: { type: mongoose_1.default.Schema.Types.Mixed, required: false },
            parsedAt: { type: Date, required: true }
        },
        required: false
    },
    errorMessage: {
        type: String
    },
    duration: {
        type: Number
    },
    requestTime: {
        type: Date,
        required: true,
        // TTL (UC-962): Mongo kayıtları requestTime'dan 7 gün sonra kendisi siler.
        // Mevcut veritabanlarında indeks TTL'siz kurulu; ensureIntegrationRequestLogTtlIndex collMod ile dönüştürür.
        index: { expires: exports.INTEGRATION_REQUEST_LOG_TTL_SECONDS }
    },
    responseTime: {
        type: Date
    },
    metadata: {
        type: mongoose_1.default.Schema.Types.Mixed
    },
    expireAt: {
        type: Date
    },
    responseSummary: {
        type: mongoose_1.default.Schema.Types.Mixed
    },
    searchKeys: {
        type: [String],
        default: undefined
    },
    requestBytes: {
        type: Number
    },
    responseBytes: {
        type: Number
    },
    idempotentSuccess: {
        type: Boolean
    }
};
const integrationRequestLogSchema = (0, base_schema_1.createBaseSchema)(integrationRequestLogSchemaDefinition);
// Virtual field: success - Computed from responseStatus
integrationRequestLogSchema.virtual('success').get(function () {
    if (!this.responseStatus)
        return false;
    return this.responseStatus >= 200 && this.responseStatus < 300;
});
// Enable virtuals in JSON and object output
integrationRequestLogSchema.set('toJSON', { virtuals: true });
integrationRequestLogSchema.set('toObject', { virtuals: true });
// Compound index for efficient queries
integrationRequestLogSchema.index({ integrationName: 1, userId: 1, requestTime: -1 });
integrationRequestLogSchema.index({ userId: 1, requestTime: -1 });
integrationRequestLogSchema.index({ integrationName: 1, requestTime: -1 });
// OperationType için yeni index'ler
integrationRequestLogSchema.index({ operationType: 1, userId: 1, requestTime: -1 });
integrationRequestLogSchema.index({ operationType: 1, integrationName: 1, requestTime: -1 });
// UC-979: sonuca göre saklama süresi — belge expireAt anında silinir. expireAt'siz (eski) belgelere
// dokunmaz; onları requestTime TTL'i (güvenlik ağı) siler.
integrationRequestLogSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
// UC-979: gelişmiş arama kimlik listesinde tam eşleşme (gövde regex'i yerine)
integrationRequestLogSchema.index({ searchKeys: 1, requestTime: -1 });
function createIntegrationRequestLogModel(connection) {
    connection.model('IntegrationRequestLog', integrationRequestLogSchema);
}
/**
 * `requestTime_1` indeksini TTL'li hale getirir (UC-962) — idempotent, her servis başlangıcında çalışır.
 *
 * Neden collMod: aynı anahtarla ikinci bir indeks açılamaz (IndexOptionsConflict) ve eski indeksi
 * düşürüp yeniden kurmak 47 GB'lık koleksiyonda tam tarama demektir. collMod yalnız indeks
 * kataloğunu günceller (Mongo ≥5.1; canlı 7.0.4).
 *
 * - İndeks TTL'li ve süre aynı → dokunmaz.
 * - İndeks var, TTL yok ya da süre farklı → collMod.
 * - Koleksiyon / indeks yok → TTL'li olarak oluşturur (şemanın autoIndex'i de aynısını yapar; eşdeğer, çakışmaz).
 *
 * Not: Bu sürümden önceki şema (`index: true`) TTL'li indekse karşı autoIndex'te IndexOptionsConflict alır;
 * mongoose bunu sessizce yutar (servis açılır, diğer indeksler kurulur) — geri dönüşte TTL yerinde kalır.
 */
async function ensureIntegrationRequestLogTtlIndex(connection, expireAfterSeconds = exports.INTEGRATION_REQUEST_LOG_TTL_SECONDS) {
    const collection = connection.model('IntegrationRequestLog').collection;
    let indexes = [];
    try {
        indexes = (await collection.indexes());
    }
    catch (error) {
        // Koleksiyon henüz yok (ilk kurulum): NamespaceNotFound
        if ((error === null || error === void 0 ? void 0 : error.code) !== 26)
            throw error;
    }
    const existing = indexes.find(index => {
        const keys = Object.keys(index.key);
        return keys.length === 1 && keys[0] === 'requestTime' && index.key.requestTime === 1;
    });
    if (existing) {
        if (existing.expireAfterSeconds === expireAfterSeconds)
            return 'unchanged';
        await connection.db.command({
            collMod: collection.collectionName,
            index: { keyPattern: { requestTime: 1 }, expireAfterSeconds }
        });
        return 'modified';
    }
    await collection.createIndex({ requestTime: 1 }, { expireAfterSeconds });
    return 'created';
}
//# sourceMappingURL=integrationRequestLog.schema.js.map