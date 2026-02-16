import mongoose from "mongoose";
import { ResourceName } from '../common';
import { BaseAttrs, BaseDoc, BaseModel } from "./base/base.schema";
export interface IntegrationBrandAttrs extends BaseAttrs {
    integrationName: ResourceName;
    externalId: string;
    name: string;
    code?: string;
    metadata?: Record<string, any>;
    lastSyncedAt?: Date;
    contentHash?: string;
}
export interface IntegrationBrandDoc extends BaseDoc {
    integrationName: ResourceName;
    externalId: string;
    name: string;
    code?: string;
    metadata?: Record<string, any>;
    lastSyncedAt: Date;
    contentHash?: string;
}
export interface IntegrationBrandModel extends BaseModel<IntegrationBrandDoc, IntegrationBrandAttrs> {
}
export declare function createIntegrationBrandModel(connection: mongoose.Connection): IntegrationBrandModel;
