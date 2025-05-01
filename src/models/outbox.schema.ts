import mongoose from "mongoose";
import { BaseAttrs, BaseDoc, BaseModel, createBaseSchema } from "./base/base.schema";
import {
    Subjects,
    ProductCreatedEvent,
    ProductUpdatedEvent,
    ProductIntegrationCreatedEvent,
    PackageProductLinkCreatedEvent,
    PackageProductLinkUpdatedEvent,
    RelationProductLinkCreatedEvent,
    RelationProductLinkUpdatedEvent,
    CombinationCreatedEvent,
    CombinationUpdatedEvent,
    UserCreatedEvent,
    UserUpdatedEvent,
    IntegrationCommandEvent,
    ProductStockCreatedEvent,
    ProductStockUpdatedEvent,
    StockCreatedEvent,
    StockUpdatedEvent,
    OrderCreatedEvent,
    OrderUpdatedEvent,
    EntityDeletedEvent,
    OrderStatusUpdatedEvent,
    IntegrationCommandResultEvent,
    ImportImagesFromUrlsEvent,
    ImportImagesFromUrlsCompletedEvent,
    DeleteProductImagesEvent,
    DeleteProductImagesCompletedEvent
} from "@xmoonx/common";

// Event tiplerini tanımla
interface EventPayloadMap {
    [Subjects.ProductCreated]: ProductCreatedEvent['data'];
    [Subjects.ProductUpdated]: ProductUpdatedEvent['data'];
    [Subjects.ProductIntegrationCreated]: ProductIntegrationCreatedEvent['data'];
    [Subjects.PackageProductLinkCreated]: PackageProductLinkCreatedEvent['data'];
    [Subjects.PackageProductLinkUpdated]: PackageProductLinkUpdatedEvent['data'];
    [Subjects.RelationProductLinkCreated]: RelationProductLinkCreatedEvent['data'];
    [Subjects.RelationProductLinkUpdated]: RelationProductLinkUpdatedEvent['data'];
    [Subjects.CombinationCreated]: CombinationCreatedEvent['data'];
    [Subjects.CombinationUpdated]: CombinationUpdatedEvent['data'];
    [Subjects.UserCreated]: UserCreatedEvent['data'];
    [Subjects.UserUpdated]: UserUpdatedEvent['data'];
    [Subjects.IntegrationCommand]: IntegrationCommandEvent['data'];
    [Subjects.IntegrationCommandResult]: IntegrationCommandResultEvent['data'];
    [Subjects.ProductStockCreated]: ProductStockCreatedEvent['data'];
    [Subjects.ProductStockUpdated]: ProductStockUpdatedEvent['data'];
    [Subjects.StockCreated]: StockCreatedEvent['data'];
    [Subjects.StockUpdated]: StockUpdatedEvent['data'];
    [Subjects.OrderCreated]: OrderCreatedEvent['data'];
    [Subjects.OrderUpdated]: OrderUpdatedEvent['data'];
    [Subjects.EntityDeleted]: EntityDeletedEvent['data'];
    [Subjects.OrderStatusUpdated]: OrderStatusUpdatedEvent['data'];
    [Subjects.ImportImagesFromUrls]: ImportImagesFromUrlsEvent['data'];
    [Subjects.ImportImagesFromUrlsCompleted]: ImportImagesFromUrlsCompletedEvent['data'];
    [Subjects.DeleteProductImages]: DeleteProductImagesEvent['data'];
    [Subjects.DeleteProductImagesCompleted]: DeleteProductImagesCompletedEvent['data'];
    // Özel event için uygun bir tip belirleyin
}

export interface OutboxAttrs<T extends keyof EventPayloadMap = keyof EventPayloadMap> extends BaseAttrs {
    eventType: T;
    payload: EventPayloadMap[T];
    status?: 'pending' | 'published' | 'completed' | 'failed';
    retryCount?: number;
    lastAttempt?: Date;
    error?: string;
    result?: any;
    processedAt?: Date;
}

export interface OutboxDoc extends BaseDoc {
    eventType: string;
    payload: any;
    status: 'pending' | 'published' | 'completed' | 'failed';
    retryCount: number;
    lastAttempt?: Date;
    error?: string;
    result?: any;
    processedAt?: Date;
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
        enum: ['pending', 'published', 'completed' , 'failed']
    },
    retryCount: { type: Number, default: 0 },
    lastAttempt: Date,
    error: {
        type: String
    },
    result: {
        type: mongoose.Schema.Types.Mixed
    },
    processedAt: {
        type: Date
    }
};

const outboxSchema = createBaseSchema(outboxSchemaDefination);

export function createOutboxModel(connection: mongoose.Connection) {
    try {
        return connection.model<OutboxDoc, OutboxModel>('Outbox');
    } catch {
        return connection.model<OutboxDoc, OutboxModel>('Outbox', outboxSchema);
    }
}