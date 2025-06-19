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
integrationBrandSchema.pre('save', function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        const shouldUpdateUniqueCode = (!this.deleted && !this.deletionDate && this.uniqueCode.indexOf("base-") !== -1) ||
            (this.isModified('externalId') || this.isModified('integrationName'));
        if (shouldUpdateUniqueCode)
            this.uniqueCode = (0, common_1.createUniqueCode)({ integrationName: this.integrationName, externalId: this.externalId });
        next();
    });
});
function createIntegrationBrandModel(connection) {
    try {
        return connection.model('IntegrationBrand');
    }
    catch (_a) {
        return connection.model('IntegrationBrand', integrationBrandSchema);
    }
}
