import mongoose from "mongoose";
import { ResourceName } from '../common';
import { BaseAttrs, BaseDoc, BaseModel } from "./base/base.schema";
export interface IntegrationRequestLogAttrs extends BaseAttrs {
    integrationName: ResourceName;
    userId: string;
    method: string;
    endpoint: string;
    requestHeaders?: Record<string, any>;
    requestBody?: Record<string, any>;
    responseStatus?: number;
    responseHeaders?: Record<string, any>;
    responseBody?: Record<string, any>;
    errorMessage?: string;
    duration?: number;
    requestTime: Date;
    responseTime?: Date;
    metadata?: Record<string, any>;
}
export interface IntegrationRequestLogDoc extends BaseDoc {
    integrationName: ResourceName;
    userId: string;
    method: string;
    endpoint: string;
    requestHeaders?: Record<string, any>;
    requestBody?: Record<string, any>;
    responseStatus?: number;
    responseHeaders?: Record<string, any>;
    responseBody?: Record<string, any>;
    errorMessage?: string;
    duration?: number;
    requestTime: Date;
    responseTime?: Date;
    metadata?: Record<string, any>;
}
export interface IntegrationRequestLogModel extends BaseModel<IntegrationRequestLogDoc, IntegrationRequestLogAttrs> {
}
export declare function createIntegrationRequestLogModel(connection: mongoose.Connection): void;
