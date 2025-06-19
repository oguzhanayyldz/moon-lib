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
function createDeadLetterModel(connection) {
    try {
        return connection.model('DeadLetter');
    }
    catch (_a) {
        return connection.model('DeadLetter', deadLetterSchema);
    }
}
