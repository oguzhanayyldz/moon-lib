"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIntegrationBrandModel = createIntegrationBrandModel;
const mongoose_1 = __importDefault(require("mongoose"));
const common_1 = require("../common");
const base_schema_1 = require("./base/base.schema");
const integrationBrandSchemaDefinition = {
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
    code: {
        type: String
    },
    metadata: {
        type: mongoose_1.default.Schema.Types.Mixed
    },
    lastSyncedAt: {
        type: Date,
        default: Date.now
    }
};
// Marka ID ve entegrasyon adı için tekil indeks oluştur
const integrationBrandSchema = (0, base_schema_1.createBaseSchema)(integrationBrandSchemaDefinition);
integrationBrandSchema.index({ integrationName: 1, externalId: 1 }, { unique: true });
// Arama performansı için compound index - platform, deleted ve name filtreleri için
integrationBrandSchema.index({ integrationName: 1, deleted: 1, name: 1 });
// Text index for full-text search on name (Turkish collation için daha iyi sonuç)
integrationBrandSchema.index({ name: 'text' }, {
    default_language: 'turkish',
    weights: { name: 10 }
});
integrationBrandSchema.pre('save', async function (next) {
    const shouldUpdateUniqueCode = (!this.deleted && !this.deletionDate && this.uniqueCode.indexOf("base-") !== -1) ||
        (this.isModified('externalId') || this.isModified('integrationName'));
    if (shouldUpdateUniqueCode)
        this.uniqueCode = (0, common_1.createUniqueCode)({ integrationName: this.integrationName, externalId: this.externalId });
    next();
});
function createIntegrationBrandModel(connection) {
    try {
        return connection.model('IntegrationBrand');
    }
    catch (_a) {
        return connection.model('IntegrationBrand', integrationBrandSchema);
    }
}
//# sourceMappingURL=integrationBrand.schema.js.map