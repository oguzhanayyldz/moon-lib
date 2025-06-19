"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIntegrationCategoryAttributesModel = createIntegrationCategoryAttributesModel;
const mongoose_1 = __importDefault(require("mongoose"));
const common_1 = require("../common");
const base_schema_1 = require("./base/base.schema");
const integrationCategoryAttributesSchemaDefinition = {
    integrationName: {
        type: String,
        required: true,
        enum: Object.values(common_1.ResourceName)
    },
    categoryExternalId: {
        type: String,
        required: true
    },
    attributeId: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    displayName: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    required: {
        type: Boolean,
        default: false
    },
    allowCustom: {
        type: Boolean,
        default: false
    },
    multiValue: {
        type: Boolean,
        default: false
    },
    values: [{
            id: { type: mongoose_1.default.Schema.Types.Mixed },
            name: { type: String, required: true },
            value: { type: mongoose_1.default.Schema.Types.Mixed }
        }],
    metadata: {
        type: mongoose_1.default.Schema.Types.Mixed
    },
    lastSyncedAt: {
        type: Date,
        default: Date.now
    }
};
// Kategori ID ve entegrasyon adı için tekil indeks oluştur
const integrationCategoryAttributesSchema = (0, base_schema_1.createBaseSchema)(integrationCategoryAttributesSchemaDefinition);
integrationCategoryAttributesSchema.pre('save', function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        const shouldUpdateUniqueCode = (!this.deleted && !this.deletionDate && this.uniqueCode.indexOf("base-") !== -1) ||
            (this.isModified('categoryExternalId') || this.isModified('integrationName') || this.isModified('attributeId'));
        if (shouldUpdateUniqueCode)
            this.uniqueCode = (0, common_1.createUniqueCode)({ integrationName: this.integrationName, categoryExternalId: this.categoryExternalId, attributeId: this.attributeId });
        next();
    });
});
function createIntegrationCategoryAttributesModel(connection) {
    try {
        return connection.model('IntegrationCategoryAttributes');
    }
    catch (_a) {
        return connection.model('IntegrationCategoryAttributes', integrationCategoryAttributesSchema);
    }
}
