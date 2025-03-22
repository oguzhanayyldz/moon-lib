import mongoose from "mongoose";
import BaseSchema, { BaseAttrs, BaseDoc, BaseModel } from "./base/base.schema";
import { CombinationCreatedEvent, CombinationUpdatedEvent, PackageProductLinkCreatedEvent, PackageProductLinkUpdatedEvent, ProductCreatedEvent, ProductUpdatedEvent, RelationProductLinkCreatedEvent, RelationProductLinkUpdatedEvent, Subjects } from "@xmoonx/common";

interface EventPayloadMap {
    [Subjects.ProductCreated]: ProductCreatedEvent['data'];
    [Subjects.ProductUpdated]: ProductUpdatedEvent['data'];
    [Subjects.PackageProductLinkCreated]: PackageProductLinkCreatedEvent['data'];
    [Subjects.PackageProductLinkUpdated]: PackageProductLinkUpdatedEvent['data'];
    [Subjects.RelationProductLinkCreated]: RelationProductLinkCreatedEvent['data'];
    [Subjects.RelationProductLinkUpdated]: RelationProductLinkUpdatedEvent['data'];
    [Subjects.CombinationCreated]: CombinationCreatedEvent['data'];
    [Subjects.CombinationUpdated]: CombinationUpdatedEvent['data'];
    // ... diğer event tipleri
}

export interface OutboxAttrs<T extends keyof EventPayloadMap = keyof EventPayloadMap> extends BaseAttrs {
    eventType: T;
    payload: EventPayloadMap[T];
    status: 'pending' | 'published' | 'failed';
    retryCount?: number;
    lastAttempt?: Date;
}

interface OutboxModel extends BaseModel<OutboxDoc, OutboxAttrs> {
}

export interface OutboxDoc extends BaseDoc {
    eventType: string;
    payload: any;
    status: 'pending' | 'published' | 'failed';
    retryCount: number;
    lastAttempt?: Date;
}

const OutboxSchema = new mongoose.Schema({
    eventType: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    status: { type: String, required: true, default: 'pending', enmum: ['pending', 'published', 'failed'] },
    retryCount: { type: Number, default: 0 },
    lastAttempt: Date
}, {
    timestamps: true
});

OutboxSchema.add(BaseSchema);

const Outbox = mongoose.model<OutboxDoc, OutboxModel>("Outbox", OutboxSchema);

export { Outbox };