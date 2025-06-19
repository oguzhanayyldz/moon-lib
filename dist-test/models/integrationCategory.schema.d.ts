import mongoose from "mongoose";
import { ResourceName } from '../common';
import { BaseAttrs, BaseDoc, BaseModel } from "./base/base.schema";
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
export interface IntegrationCategoryModel extends BaseModel<IntegrationCategoryDoc, IntegrationCategoryAttrs> {
}
export declare function createIntegrationCategoryModel(connection: mongoose.Connection): IntegrationCategoryModel;
//# sourceMappingURL=integrationCategory.schema.d.ts.map