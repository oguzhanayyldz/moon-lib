"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDeadLetterModel = createDeadLetterModel;
const mongoose_1 = __importDefault(require("mongoose"));
const base_schema_1 = __importDefault(require("./base/base.schema"));
const deadLetterSchemaDefination = {
    subject: {
        type: String,
        required: true,
    },
    eventId: {
        type: String,
        required: true,
    },
    data: {
        type: mongoose_1.default.Schema.Types.Mixed,
        required: true,
    },
    error: {
        type: String,
        required: true,
    },
    retryCount: {
        type: Number,
        default: 0,
        required: true,
    },
    maxRetries: {
        type: Number,
        default: 5,
        required: true,
    },
    service: {
        type: String,
        required: true,
    },
    environment: {
        type: String,
        required: true,
        default: () => process.env.NODE_ENV || 'production',
        enum: ['production', 'development', 'test'],
        index: true
    },
    nextRetryAt: {
        type: Date,
        required: true,
    },
    timestamp: {
        type: Date,
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
    },
    processorId: {
        type: String,
    },
    processingStartedAt: {
        type: Date,
    },
    completedAt: {
        type: Date,
    }
};
const deadLetterSchema = (0, base_schema_1.default)(deadLetterSchemaDefination);
// Compound index for optimal query performance
// Optimizes: { status: 'pending', environment: 'production', retryCount: { $lt: maxRetries } }
deadLetterSchema.index({ status: 1, environment: 1, retryCount: 1, nextRetryAt: 1 });
function createDeadLetterModel(connection) {
    try {
        return connection.model('DeadLetter');
    }
    catch (_a) {
        return connection.model('DeadLetter', deadLetterSchema);
    }
}
//# sourceMappingURL=deadLetter.schema.js.map