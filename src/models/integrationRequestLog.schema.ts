import mongoose from "mongoose";
import { ResourceName } from '../common';
import { OperationType } from '../enums/operation-type.enum';
import { BaseAttrs, BaseDoc, BaseModel, createBaseSchema } from "./base/base.schema";

/**
 * Yorumlanmış/özetlenmiş yanıt yapısı
 */
export interface InterpretedResponse {
    summary: string;              // İşlem özeti (örn: "15 ürün başarıyla gönderildi, 2 ürün başarısız")
    success: boolean;             // Genel başarı durumu
    successCount?: number;        // Başarılı işlem sayısı
    failureCount?: number;        // Başarısız işlem sayısı
    details?: Record<string, any>; // Ek detaylar (platform-specific)
    parsedAt: Date;               // Parse edilme zamanı
}

export interface IntegrationRequestLogAttrs extends BaseAttrs {
    integrationName: ResourceName;
    userId: string;
    operationType?: OperationType; // İşlem kategorisi (nullable - eski kayıtlar için)
    method: string;
    endpoint: string;
    requestHeaders?: Record<string, any>;
    requestBody?: Record<string, any>;
    responseStatus?: number;
    responseHeaders?: Record<string, any>;
    responseBody?: Record<string, any>;
    interpretedResponse?: InterpretedResponse; // Yorumlanmış yanıt
    errorMessage?: string;
    duration?: number; // milliseconds
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
    operationType: {
        type: String,
        required: false, // Eski kayıtlar için nullable
        enum: Object.values(OperationType),
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
    interpretedResponse: {
        type: {
            summary: { type: String, required: true },
            success: { type: Boolean, required: true },
            successCount: { type: Number, required: false },
            failureCount: { type: Number, required: false },
            details: { type: mongoose.Schema.Types.Mixed, required: false },
            parsedAt: { type: Date, required: true }
        },
        required: false
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

// Virtual field: success - Computed from responseStatus
integrationRequestLogSchema.virtual('success').get(function(this: IntegrationRequestLogDoc) {
    if (!this.responseStatus) return false;
    return this.responseStatus >= 200 && this.responseStatus < 300;
});

// Enable virtuals in JSON and object output
integrationRequestLogSchema.set('toJSON', { virtuals: true });
integrationRequestLogSchema.set('toObject', { virtuals: true });

// Compound index for efficient queries
integrationRequestLogSchema.index({ integrationName: 1, userId: 1, requestTime: -1 });
integrationRequestLogSchema.index({ userId: 1, requestTime: -1 });
integrationRequestLogSchema.index({ integrationName: 1, requestTime: -1 });
// OperationType için yeni index'ler
integrationRequestLogSchema.index({ operationType: 1, userId: 1, requestTime: -1 });
integrationRequestLogSchema.index({ operationType: 1, integrationName: 1, requestTime: -1 });

export function createIntegrationRequestLogModel(connection: mongoose.Connection): void {
    connection.model<IntegrationRequestLogDoc, IntegrationRequestLogModel>('IntegrationRequestLog', integrationRequestLogSchema);
}
