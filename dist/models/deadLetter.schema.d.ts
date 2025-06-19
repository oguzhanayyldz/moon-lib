import mongoose from 'mongoose';
import { BaseAttrs, BaseDoc, BaseModel } from './base/base.schema';
export interface DeadLetterAttrs extends BaseAttrs {
    subject: string;
    eventId: string;
    data: any;
    error: string;
    retryCount: number;
    maxRetries: number;
    service: string;
    nextRetryAt: Date;
    timestamp: Date;
    processorId?: string;
    processingStartedAt?: Date;
    completedAt?: Date;
}
export interface DeadLetterModel extends BaseModel<DeadLetterDoc, DeadLetterAttrs> {
}
export interface DeadLetterDoc extends BaseDoc {
    subject: string;
    eventId: string;
    data: any;
    error: string;
    retryCount: number;
    maxRetries: number;
    service: string;
    nextRetryAt: Date;
    timestamp: Date;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    processorId?: string;
    processingStartedAt?: Date;
    completedAt?: Date;
}
export declare function createDeadLetterModel(connection: mongoose.Connection): DeadLetterModel;
