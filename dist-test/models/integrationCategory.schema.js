"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIntegrationCategoryModel = createIntegrationCategoryModel;
const mongoose_1 = __importDefault(require("mongoose"));
const common_1 = require("../common");
const base_schema_1 = require("./base/base.schema");
const integrationCategorySchemaDefinition = {
    integrationName: {
        type: String,
        required: true,
        enum: Object.values(common_1.ResourceName)
    },
    externalId: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    parentId: {
        type: String
    },
    code: {
        type: String
    },
    level: {
        type: Number
    },
    metadata: {
        type: mongoose_1.default.Schema.Types.Mixed
    },
    lastSyncedAt: {
        type: Date,
        default: Date.now
    }
};
// Kategori ID ve entegrasyon adı için tekil indeks oluştur
const integrationCategorySchema = (0, base_schema_1.createBaseSchema)(integrationCategorySchemaDefinition);
integrationCategorySchema.index({ integrationName: 1, externalId: 1 }, { unique: true });
integrationCategorySchema.pre('save', async function (next) {
    const shouldUpdateUniqueCode = (!this.deleted && !this.deletionDate && this.uniqueCode.indexOf("base-") !== -1) ||
        (this.isModified('externalId') || this.isModified('integrationName'));
    if (shouldUpdateUniqueCode)
        this.uniqueCode = (0, common_1.createUniqueCode)({ integrationName: this.integrationName, externalId: this.externalId });
    next();
});
function createIntegrationCategoryModel(connection) {
    try {
        return connection.model('IntegrationCategory');
    }
    catch (_a) {
        return connection.model('IntegrationCategory', integrationCategorySchema);
    }
}
//# sourceMappingURL=integrationCategory.schema.js.map