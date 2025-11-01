"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOutboxModel = createOutboxModel;
const mongoose_1 = __importDefault(require("mongoose"));
const base_schema_1 = require("./base/base.schema");
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
    }
};
const outboxSchema = (0, base_schema_1.createBaseSchema)(outboxSchemaDefination);
// Compound index for optimal query performance
// Optimizes: { status: 'pending', environment: 'production', retryCount: { $lt: 5 } }
outboxSchema.index({ status: 1, environment: 1, retryCount: 1, createdAt: 1 });
function createOutboxModel(connection) {
    try {
        return connection.model('Outbox');
    }
    catch (_a) {
        return connection.model('Outbox', outboxSchema);
    }
}
