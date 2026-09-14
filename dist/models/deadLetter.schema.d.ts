import mongoose from 'mongoose';
import { BaseAttrs, BaseDoc, BaseModel } from './base/base.schema';
export type DeadLetterStatus = 'pending' | 'processing' | 'queued' | 'replaying' | 'completed' | 'failed';
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
    status?: DeadLetterStatus;
    listenerKey?: string;
    queueGroupName?: string;
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
    environment: 'production' | 'development' | 'test';
    nextRetryAt: Date;
    timestamp: Date;
    status: DeadLetterStatus;
    listenerKey?: string;
    queueGroupName?: string;
    processorId?: string;
    processingStartedAt?: Date;
    completedAt?: Date;
}
export declare function createDeadLetterModel(connection: mongoose.Connection): DeadLetterModel;
