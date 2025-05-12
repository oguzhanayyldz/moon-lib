"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOutboxModel = createOutboxModel;
const mongoose_1 = __importDefault(require("mongoose"));
const base_schema_1 = require("./base/base.schema");
const common_1 = require("@xmoonx/common");
// Schema tanımı
const outboxSchemaDefination = {
    eventType: { type: String, required: true },
    payload: { type: mongoose_1.default.Schema.Types.Mixed, required: true },
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
function createOutboxModel(connection) {
    try {
        return connection.model('Outbox');
    }
    catch (_a) {
        return connection.model('Outbox', outboxSchema);
    }
}
