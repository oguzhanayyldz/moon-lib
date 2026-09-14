import mongoose from 'mongoose';
import createBaseSchema, { BaseAttrs, BaseDoc, BaseModel } from './base/base.schema';

// Kayıt durumları:
// - queued / replaying: hedefli oynatma (issue #648 DLQ-H). Kaydı yazan listener bu süreçte oynatır.
// - pending / processing: DLQ-H öncesi, subject'e yayınla oynatılan kayıtlar. DLQ-H işlemcisi bunları seçmez;
//   eski sürüm işlemci de queued/replaying seçmediği için karma sürümde ve geri almada kayıt yayınlanmaz.
// - completed / failed: son durumlar.
export type DeadLetterStatus = 'pending' | 'processing' | 'queued' | 'replaying' | 'completed' | 'failed';

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
    status?: DeadLetterStatus;
    listenerKey?: string;
    queueGroupName?: string;
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
    status: DeadLetterStatus;
    listenerKey?: string;
    queueGroupName?: string;
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
        enum: ['pending', 'processing', 'queued', 'replaying', 'completed', 'failed'],
        default: 'pending'
    },
    // Kaydı yazan listener: "<subject>|<queueGroupName>" (issue #648 DLQ-H). Yalnız bu listener'ı başlatmış süreç oynatır.
    listenerKey: {
        type: String,
    },
    queueGroupName: {
        type: String,
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
// Issue #648 öncesindeki sorgu biçimi için: { status: 'pending', environment, retryCount: { $lt: 5 } }.
// Mevcut veritabanlarında kurulu olduğu için tanımda bırakıldı.
deadLetterSchema.index({ status: 1, environment: 1, retryCount: 1, nextRetryAt: 1 });
// Issue #648 DLQ-H: DeadLetterProcessorJob sorgusu { status: 'queued', environment, listenerKey: { $in: <kayıtlı anahtarlar> },
// nextRetryAt: { $lte: now } } ve sıralaması { nextRetryAt: 1 }. Bütçe koşulu ($expr: retryCount < maxRetries) index kullanamaz;
// yalnız bu index'in daralttığı, zamanı gelmiş kayıtlar üzerinde değerlendirilir. Oynatıcısı olmayan kayıt sayımı
// ({ status: 'queued', environment, listenerKey: { $nin } }) aynı index'in önekini kullanır.
deadLetterSchema.index({ status: 1, environment: 1, listenerKey: 1, nextRetryAt: 1 });

export function createDeadLetterModel(connection: mongoose.Connection) {
    try {
        return connection.model<DeadLetterDoc, DeadLetterModel>('DeadLetter');
    } catch {
        return connection.model<DeadLetterDoc, DeadLetterModel>('DeadLetter', deadLetterSchema);
    }
}