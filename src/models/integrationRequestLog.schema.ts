import mongoose from "mongoose";
import { ResourceName } from '@xmoonx/common';
import { BaseAttrs, BaseDoc, BaseModel, createBaseSchema } from "./base/base.schema";

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
    duration?: number; // milliseconds
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

export interface IntegrationRequestLogModel extends BaseModel<IntegrationRequestLogDoc, IntegrationRequestLogAttrs> { }

const integrationRequestLogSchemaDefinition = {
    integrationName: {
        type: String,
        required: true,
        enum: Object.values(ResourceName)
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    method: {
        type: String,
        required: true,
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
    },
    endpoint: {
        type: String,
        required: true
    },
    requestHeaders: {
        type: mongoose.Schema.Types.Mixed
    },
    requestBody: {
        type: mongoose.Schema.Types.Mixed
    },
    responseStatus: {
        type: Number
    },
    responseHeaders: {
        type: mongoose.Schema.Types.Mixed
    },
    responseBody: {
        type: mongoose.Schema.Types.Mixed
    },
    errorMessage: {
        type: String
    },
    duration: {
        type: Number
    },
    requestTime: {
        type: Date,
        required: true,
        index: true
    },
    responseTime: {
        type: Date
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed
    }
};

const integrationRequestLogSchema = createBaseSchema(integrationRequestLogSchemaDefinition);

// Compound index for efficient queries
integrationRequestLogSchema.index({ integrationName: 1, userId: 1, requestTime: -1 });
integrationRequestLogSchema.index({ userId: 1, requestTime: -1 });
integrationRequestLogSchema.index({ integrationName: 1, requestTime: -1 });

export function createIntegrationRequestLogModel(connection: mongoose.Connection): void {
    connection.model<IntegrationRequestLogDoc, IntegrationRequestLogModel>('IntegrationRequestLog', integrationRequestLogSchema);
}
