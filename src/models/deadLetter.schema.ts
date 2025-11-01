import mongoose from 'mongoose';
import createBaseSchema, { BaseAttrs, BaseDoc, BaseModel } from './base/base.schema';

// Dead Letter dokümanları için Arayüz
export interface DeadLetterAttrs extends BaseAttrs {
    subject: string;
    eventId: string;
    data: any;
    error: string;
    retryCount: number;
    maxRetries: number;
    service: string;
    environment?: 'production' | 'development' | 'test';
    nextRetryAt: Date;
    timestamp: Date;
    processorId?: string;
    processingStartedAt?: Date;
    completedAt?: Date;
}

// Interface that describes the properties a Dead Letter Model has
export interface DeadLetterModel extends BaseModel<DeadLetterDoc, DeadLetterAttrs> {
}

// Interface that describes the properties a Dead Letter Document has
export interface DeadLetterDoc extends BaseDoc {
    subject: string;
    eventId: string;
    data: any;
    error: string;
    retryCount: number;
    maxRetries: number;
    service: string;
    environment: 'production' | 'development' | 'test';
    nextRetryAt: Date;
    timestamp: Date;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    processorId?: string;
    processingStartedAt?: Date;
    completedAt?: Date;
}

const deadLetterSchemaDefination = {
    subject: {
        type: String,
        required: true,
    },
    eventId: {
        type: String,
        required: true,
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },
    error: {
        type: String,
        required: true,
    },
    retryCount: {
        type: Number,
        default: 0,
        required: true,
    },
    maxRetries: {
        type: Number,
        default: 5,
        required: true,
    },
    service: {
        type: String,
        required: true,
    },
    environment: {
        type: String,
        required: true,
        default: () => process.env.NODE_ENV || 'production',
        enum: ['production', 'development', 'test'],
        index: true
    },
    nextRetryAt: {
        type: Date,
        required: true,
    },
    timestamp: {
        type: Date,
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
    },
    processorId: {
        type: String,
    },
    processingStartedAt: {
        type: Date,
    },
    completedAt: {
        type: Date,
    }
};

const deadLetterSchema = createBaseSchema(deadLetterSchemaDefination);

// Compound index for optimal query performance
// Optimizes: { status: 'pending', environment: 'production', retryCount: { $lt: maxRetries } }
deadLetterSchema.index({ status: 1, environment: 1, retryCount: 1, nextRetryAt: 1 });

export function createDeadLetterModel(connection: mongoose.Connection) {
    try {
        return connection.model<DeadLetterDoc, DeadLetterModel>('DeadLetter');
    } catch {
        return connection.model<DeadLetterDoc, DeadLetterModel>('DeadLetter', deadLetterSchema);
    }
}