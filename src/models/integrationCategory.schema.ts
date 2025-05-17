import mongoose from "mongoose";
import { createUniqueCode, ResourceName } from '@xmoonx/common';
import { BaseAttrs, BaseDoc, BaseModel, createBaseSchema } from "./base/base.schema";

export interface IntegrationCategoryAttrs extends BaseAttrs {
    integrationName: ResourceName;
    externalId: string;
    name: string;
    parentId?: string;
    code?: string;
    level?: number;
    metadata?: Record<string, any>;
    lastSyncedAt?: Date;
}

export interface IntegrationCategoryDoc extends BaseDoc {
    integrationName: ResourceName;
    externalId: string;
    name: string;
    parentId?: string;
    code?: string;
    level?: number;
    metadata?: Record<string, any>;
    lastSyncedAt: Date;
}

export interface IntegrationCategoryModel extends BaseModel<IntegrationCategoryDoc, IntegrationCategoryAttrs> { }

const integrationCategorySchemaDefinition = {
    integrationName: {
        type: String,
        required: true,
        enum: Object.values(ResourceName)
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
        type: mongoose.Schema.Types.Mixed
    },
    lastSyncedAt: {
        type: Date,
        default: Date.now
    }
};

// Kategori ID ve entegrasyon adı için tekil indeks oluştur
const integrationCategorySchema = createBaseSchema(integrationCategorySchemaDefinition);
integrationCategorySchema.index({ integrationName: 1, externalId: 1 }, { unique: true });

integrationCategorySchema.pre<IntegrationCategoryDoc>('save', async function (next) {
    const shouldUpdateUniqueCode = 
        (!this.deleted && !this.deletionDate && this.uniqueCode.indexOf("base-") !== -1) ||
        (this.isModified('externalId') || this.isModified('integrationName'));

    if (shouldUpdateUniqueCode) this.uniqueCode = createUniqueCode({ integrationName: this.integrationName, externalId: this.externalId});
    next();
});

export function createIntegrationCategoryModel(connection: mongoose.Connection) {
    try {
        return connection.model<IntegrationCategoryDoc, IntegrationCategoryModel>('IntegrationCategory');
    } catch {
        return connection.model<IntegrationCategoryDoc, IntegrationCategoryModel>('IntegrationCategory', integrationCategorySchema);
    }
} 