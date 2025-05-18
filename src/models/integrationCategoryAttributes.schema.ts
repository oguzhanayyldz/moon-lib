import mongoose from "mongoose";
import { createUniqueCode, ResourceName } from '@xmoonx/common';
import { BaseAttrs, BaseDoc, BaseModel, createBaseSchema } from "./base/base.schema";

export interface IntegrationCategoryAttributesAttrs extends BaseAttrs {
    integrationName: ResourceName;
    categoryExternalId: string;
    attributeId: string;
    name: string;
    displayName: string;
    type: string;
    required: boolean;
    allowCustom: boolean;
    multiValue: boolean;
    values?: Array<{
        id?: string | number;
        name: string;
        value?: string | number;
    }>;
    metadata?: Record<string, any>;
    lastSyncedAt?: Date;
}

export interface IntegrationCategoryAttributesDoc extends BaseDoc {
    integrationName: ResourceName;
    categoryExternalId: string;
    attributeId: string;
    name: string;
    displayName: string;
    type: string;
    required: boolean;
    allowCustom: boolean;
    multiValue: boolean;
    values?: Array<{
        id?: string | number;
        name: string;
        value?: string | number;
    }>;
    metadata?: Record<string, any>;
    lastSyncedAt: Date;
}

export interface IntegrationCategoryAttributesModel extends BaseModel<IntegrationCategoryAttributesDoc, IntegrationCategoryAttributesAttrs> { }

const integrationCategoryAttributesSchemaDefinition = {
    integrationName: {
        type: String,
        required: true,
        enum: Object.values(ResourceName)
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
        id: { type: mongoose.Schema.Types.Mixed },
        name: { type: String, required: true },
        value: { type: mongoose.Schema.Types.Mixed }
    }],
    metadata: {
        type: mongoose.Schema.Types.Mixed
    },
    lastSyncedAt: {
        type: Date,
        default: Date.now
    }
};

// Kategori ID ve entegrasyon adı için tekil indeks oluştur
const integrationCategoryAttributesSchema = createBaseSchema(integrationCategoryAttributesSchemaDefinition);

integrationCategoryAttributesSchema.pre<IntegrationCategoryAttributesDoc>('save', async function (next) {
    const shouldUpdateUniqueCode = 
        (!this.deleted && !this.deletionDate && this.uniqueCode.indexOf("base-") !== -1) ||
        (this.isModified('categoryExternalId') || this.isModified('integrationName') || this.isModified('attributeId'));

    if (shouldUpdateUniqueCode) this.uniqueCode = createUniqueCode({ integrationName: this.integrationName, categoryExternalId: this.categoryExternalId, attributeId: this.attributeId});
    next();
});

export function createIntegrationCategoryAttributesModel(connection: mongoose.Connection) {
    try {
        return connection.model<IntegrationCategoryAttributesDoc, IntegrationCategoryAttributesModel>('IntegrationCategoryAttributes');
    } catch {
        return connection.model<IntegrationCategoryAttributesDoc, IntegrationCategoryAttributesModel>('IntegrationCategoryAttributes', integrationCategoryAttributesSchema);
    }
} 