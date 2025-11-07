import mongoose from "mongoose";
import { ResourceName } from '../common';
import { OperationType } from '../enums/operation-type.enum';
import { BaseAttrs, BaseDoc, BaseModel } from "./base/base.schema";
/**
 * Yorumlanmış/özetlenmiş yanıt yapısı
 */
export interface InterpretedResponse {
    summary: string;
    success: boolean;
    successCount?: number;
    failureCount?: number;
    details?: Record<string, any>;
    parsedAt: Date;
}
export interface IntegrationRequestLogAttrs extends BaseAttrs {
    integrationName: ResourceName;
    userId: string;
    operationType?: OperationType;
    method: string;
    endpoint: string;
    requestHeaders?: Record<string, any>;
    requestBody?: Record<string, any>;
    responseStatus?: number;
    responseHeaders?: Record<string, any>;
    responseBody?: Record<string, any>;
    interpretedResponse?: InterpretedResponse;
    errorMessage?: string;
    duration?: number;
    requestTime: Date;
    responseTime?: Date;
    metadata?: Record<string, any>;
}
export interface IntegrationRequestLogDoc extends BaseDoc {
    integrationName: ResourceName;
    userId: string;
    operationType?: OperationType;
    method: string;
    endpoint: string;
    requestHeaders?: Record<string, any>;
    requestBody?: Record<string, any>;
    responseStatus?: number;
    responseHeaders?: Record<string, any>;
    responseBody?: Record<string, any>;
    interpretedResponse?: InterpretedResponse;
    errorMessage?: string;
    duration?: number;
    requestTime: Date;
    responseTime?: Date;
    metadata?: Record<string, any>;
}
export interface IntegrationRequestLogModel extends BaseModel<IntegrationRequestLogDoc, IntegrationRequestLogAttrs> {
}
export declare function createIntegrationRequestLogModel(connection: mongoose.Connection): void;
