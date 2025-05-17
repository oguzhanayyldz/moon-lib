import mongoose from "mongoose";
import { createUniqueCode, ResourceName } from '@xmoonx/common';
import { BaseAttrs, BaseDoc, BaseModel, createBaseSchema } from "./base/base.schema";

export interface IntegrationBrandAttrs extends BaseAttrs {
    integrationName: ResourceName;
    externalId: string;
    name: string;
    code?: string;
    metadata?: Record<string, any>;
    lastSyncedAt?: Date;
}

export interface IntegrationBrandDoc extends BaseDoc {
    integrationName: ResourceName;
    externalId: string;
    name: string;
    code?: string;
    metadata?: Record<string, any>;
    lastSyncedAt: Date;
}

export interface IntegrationBrandModel extends BaseModel<IntegrationBrandDoc, IntegrationBrandAttrs> { }

const integrationBrandSchemaDefinition = {
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
    code: {
        type: String
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed
    },
    lastSyncedAt: {
        type: Date,
        default: Date.now
    }
};

// Marka ID ve entegrasyon adı için tekil indeks oluştur
const integrationBrandSchema = createBaseSchema(integrationBrandSchemaDefinition);

integrationBrandSchema.pre<IntegrationBrandDoc>('save', async function (next) {
    const shouldUpdateUniqueCode = 
        (!this.deleted && !this.deletionDate && this.uniqueCode.indexOf("base-") !== -1) ||
        (this.isModified('externalId') || this.isModified('integrationName'));

    if (shouldUpdateUniqueCode) this.uniqueCode = createUniqueCode({ integrationName: this.integrationName, externalId: this.externalId});
    next();
});

export function createIntegrationBrandModel(connection: mongoose.Connection) {
    try {
        return connection.model<IntegrationBrandDoc, IntegrationBrandModel>('IntegrationBrand');
    } catch {
        return connection.model<IntegrationBrandDoc, IntegrationBrandModel>('IntegrationBrand', integrationBrandSchema);
    }
} 