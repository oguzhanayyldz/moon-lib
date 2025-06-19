"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIntegrationRequestLogModel = createIntegrationRequestLogModel;
const mongoose_1 = __importDefault(require("mongoose"));
const common_1 = require("../common");
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
// Compound index for efficient queries
integrationRequestLogSchema.index({ integrationName: 1, userId: 1, requestTime: -1 });
integrationRequestLogSchema.index({ userId: 1, requestTime: -1 });
integrationRequestLogSchema.index({ integrationName: 1, requestTime: -1 });
function createIntegrationRequestLogModel(connection) {
    connection.model('IntegrationRequestLog', integrationRequestLogSchema);
}
//# sourceMappingURL=integrationRequestLog.schema.js.map