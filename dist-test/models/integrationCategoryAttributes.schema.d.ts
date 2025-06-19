import mongoose from "mongoose";
import { ResourceName } from '../common';
import { BaseAttrs, BaseDoc, BaseModel } from "./base/base.schema";
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
export interface IntegrationCategoryAttributesModel extends BaseModel<IntegrationCategoryAttributesDoc, IntegrationCategoryAttributesAttrs> {
}
export declare function createIntegrationCategoryAttributesModel(connection: mongoose.Connection): IntegrationCategoryAttributesModel;
//# sourceMappingURL=integrationCategoryAttributes.schema.d.ts.map