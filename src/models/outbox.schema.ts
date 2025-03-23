import mongoose from "mongoose";
import { BaseAttrs, BaseDoc, BaseModel, createBaseSchema } from "./base/base.schema";
import {
    Subjects,
    ProductCreatedEvent,
    ProductUpdatedEvent,
    PackageProductLinkCreatedEvent,
    PackageProductLinkUpdatedEvent,
    RelationProductLinkCreatedEvent,
    RelationProductLinkUpdatedEvent,
    CombinationCreatedEvent,
    CombinationUpdatedEvent
} from "@xmoonx/common";

// Event tiplerini tanımla
interface EventPayloadMap {
    [Subjects.ProductCreated]: ProductCreatedEvent['data'];
    [Subjects.ProductUpdated]: ProductUpdatedEvent['data'];
    [Subjects.PackageProductLinkCreated]: PackageProductLinkCreatedEvent['data'];
    [Subjects.PackageProductLinkUpdated]: PackageProductLinkUpdatedEvent['data'];
    [Subjects.RelationProductLinkCreated]: RelationProductLinkCreatedEvent['data'];
    [Subjects.RelationProductLinkUpdated]: RelationProductLinkUpdatedEvent['data'];
    [Subjects.CombinationCreated]: CombinationCreatedEvent['data'];
    [Subjects.CombinationUpdated]: CombinationUpdatedEvent['data'];
}

export interface OutboxAttrs<T extends keyof EventPayloadMap = keyof EventPayloadMap> extends BaseAttrs {
    eventType: T;
    payload: EventPayloadMap[T];
    status: 'pending' | 'published' | 'failed';
    retryCount?: number;
    lastAttempt?: Date;
}

export interface OutboxDoc extends BaseDoc {
    eventType: string;
    payload: any;
    status: 'pending' | 'published' | 'failed';
    retryCount: number;
    lastAttempt?: Date;
}

export interface OutboxModel extends BaseModel<OutboxDoc, OutboxAttrs> { }

// Schema tanımı
const outboxSchemaDefination = {
    eventType: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
        type: String,
        required: true,
        default: 'pending',
        enum: ['pending', 'published', 'failed']
    },
    retryCount: { type: Number, default: 0 },
    lastAttempt: Date
};

const outboxSchema = createBaseSchema(outboxSchemaDefination);

export function createOutboxModel(connection: mongoose.Connection) {
    try {
        return connection.model<OutboxDoc, OutboxModel>('Outbox');
    } catch {
        return connection.model<OutboxDoc, OutboxModel>('Outbox', outboxSchema);
    }
}