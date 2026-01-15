"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEventPriority = getEventPriority;
exports.extractUserIdFromPayload = extractUserIdFromPayload;
exports.createOutboxModel = createOutboxModel;
const mongoose_1 = __importDefault(require("mongoose"));
const base_schema_1 = require("./base/base.schema");
const logger_service_1 = require("../services/logger.service");
const common_1 = require("../common");
// Schema tanımı
const outboxSchemaDefination = {
    eventType: { type: String, required: true },
    payload: { type: mongoose_1.default.Schema.Types.Mixed, required: true },
    environment: {
        type: String,
        required: true,
        default: () => process.env.NODE_ENV || 'production',
        enum: ['production', 'development', 'test'],
        index: true
    },
    status: {
        type: String,
        required: true,
        default: 'pending',
        enum: ['pending', 'processing', 'published', 'completed', 'failed']
    },
    retryCount: { type: Number, default: 0 },
    lastAttempt: Date,
    error: {
        type: String
    },
    result: {
        type: mongoose_1.default.Schema.Types.Mixed
    },
    processedAt: {
        type: Date
    },
    priority: {
        type: Number,
        min: 1,
        max: 5,
        index: true
        // NOT: Default yok - pre-save hook'ta hesaplanacak
    },
    userId: {
        type: String,
        index: true
        // NOT: Default yok - pre-save hook'ta hesaplanacak
    }
};
const outboxSchema = (0, base_schema_1.createBaseSchema)(outboxSchemaDefination);
// Event tipine göre öncelik belirleme
function getEventPriority(eventType) {
    var _a;
    const PRIORITY_MAP = {
        // Priority 1: Core (User) + Delete (silme EN ÖNCELİKLİ!)
        [common_1.Subjects.UserCreated]: 1,
        [common_1.Subjects.UserUpdated]: 1,
        [common_1.Subjects.EntityDeleted]: 1, // Silme işlemi en öncelikli - önce sil, sonra yenisini oluştur
        // Priority 2: Primary Entity (Create/Update)
        [common_1.Subjects.ProductCreated]: 2,
        [common_1.Subjects.ProductUpdated]: 2,
        [common_1.Subjects.OrderCreated]: 2,
        [common_1.Subjects.OrderUpdated]: 2,
        [common_1.Subjects.IntegrationCreated]: 2,
        [common_1.Subjects.IntegrationUpdated]: 2,
        // Priority 3: Secondary Entity
        [common_1.Subjects.CombinationCreated]: 3,
        [common_1.Subjects.CombinationUpdated]: 3,
        [common_1.Subjects.StockCreated]: 3,
        [common_1.Subjects.StockUpdated]: 3,
        [common_1.Subjects.CategoryCreated]: 3,
        [common_1.Subjects.CategoryUpdated]: 3,
        [common_1.Subjects.BrandCreated]: 3,
        [common_1.Subjects.BrandUpdated]: 3,
        [common_1.Subjects.ProductStockCreated]: 3,
        [common_1.Subjects.ProductStockUpdated]: 3,
        // Priority 4: Integration Data
        [common_1.Subjects.ProductPriceIntegrationUpdated]: 4,
        [common_1.Subjects.ProductStockIntegrationUpdated]: 4,
        [common_1.Subjects.ProductImageIntegrationUpdated]: 4,
        [common_1.Subjects.ProductIntegrationCreated]: 4,
        [common_1.Subjects.ProductIntegrationSynced]: 4,
        [common_1.Subjects.OrderIntegrationCreated]: 4,
        [common_1.Subjects.ProductPriceUpdated]: 4,
        [common_1.Subjects.CatalogMappingCreated]: 4,
        [common_1.Subjects.CatalogMappingUpdated]: 4,
        // Priority 5: Sync/Notification
        [common_1.Subjects.EntityVersionUpdated]: 5,
        [common_1.Subjects.EntityVersionBulkUpdated]: 5,
        [common_1.Subjects.NotificationCreated]: 5,
        [common_1.Subjects.SyncRequested]: 5,
    };
    return (_a = PRIORITY_MAP[eventType]) !== null && _a !== void 0 ? _a : 3;
}
// Payload'dan userId çıkarma
function extractUserIdFromPayload(payload) {
    var _a, _b, _c, _d, _e, _f;
    // 1. Direkt userId
    if (payload.userId)
        return payload.userId;
    // 2. Direkt user
    if (payload.user)
        return payload.user;
    // 3. list[0].user (ProductCreated, CombinationCreated)
    if ((_b = (_a = payload.list) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.user)
        return payload.list[0].user;
    // 4. data içinde (EntityDeleted vb.)
    if ((_c = payload.data) === null || _c === void 0 ? void 0 : _c.userId)
        return payload.data.userId;
    if ((_d = payload.data) === null || _d === void 0 ? void 0 : _d.user)
        return payload.data.user;
    // 5. items içinde
    if ((_f = (_e = payload.items) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.userId)
        return payload.items[0].userId;
    // Bulunamazsa _system_ (en yüksek öncelikli)
    return '_system_';
}
// Pre-save hook: priority ve userId her zaman hesapla
outboxSchema.pre('save', function (next) {
    const doc = this;
    if (this.isNew) {
        // Priority'yi eventType'a göre hesapla (her zaman yeniden hesapla)
        doc.priority = getEventPriority(doc.eventType);
        // userId'yi payload'dan çıkar (her zaman yeniden hesapla)
        doc.userId = extractUserIdFromPayload(doc.payload);
        logger_service_1.logger.debug(`Outbox created: eventType=${doc.eventType}, priority=${doc.priority}, userId=${doc.userId}`);
    }
    next();
});
// Compound index for optimal query performance with priority
// _system_ users get processed first, then by priority within each user
outboxSchema.index({ status: 1, environment: 1, userId: 1, priority: 1, creationDate: 1 });
outboxSchema.index({ status: 1, environment: 1, retryCount: 1, creationDate: 1 });
function createOutboxModel(connection) {
    try {
        return connection.model('Outbox');
    }
    catch (_a) {
        return connection.model('Outbox', outboxSchema);
    }
}
