"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIntegrationRequestLogModel = createIntegrationRequestLogModel;
const mongoose_1 = __importDefault(require("mongoose"));
const common_1 = require("../common");
const operation_type_enum_1 = require("../enums/operation-type.enum");
const base_schema_1 = require("./base/base.schema");
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
        index: true
    },
    responseTime: {
        type: Date
    },
    metadata: {
        type: mongoose_1.default.Schema.Types.Mixed
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
function createIntegrationRequestLogModel(connection) {
    connection.model('IntegrationRequestLog', integrationRequestLogSchema);
}
