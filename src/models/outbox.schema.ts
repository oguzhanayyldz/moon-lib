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
    DeleteProductImagesCompletedEvent,
    ProductPriceIntegrationUpdatedEvent,
    ProductPriceUpdatedEvent,
    ProductErpIdUpdatedEvent,
    ProductStockIntegrationUpdatedEvent,
    CatalogMappingCreatedEvent,
    ProductImageIntegrationUpdatedEvent, 
    ProductIntegrationSyncedEvent,
    OrderIntegrationCreatedEvent,
    IntegrationCreatedEvent,
    UserIntegrationSettingsEvent,
    OrderIntegrationStatusUpdatedEvent,
    ProductMatchedEvent,
    NotificationCreatedEvent,
    OrderProductStockUpdatedEvent,
    EntityVersionUpdatedEvent,
    SyncRequestedEvent,
    InvoiceUpdatedEvent,
    InvoiceCreatedEvent,
    InvoiceFormalizedEvent,
    InvoiceFailedEvent,
} from "../common";

// Event tiplerini tanımla
interface EventPayloadMap {
    [Subjects.ProductCreated]: ProductCreatedEvent['data'];
    [Subjects.ProductUpdated]: ProductUpdatedEvent['data'];
    [Subjects.ProductIntegrationCreated]: ProductIntegrationCreatedEvent['data'];
    [Subjects.ProductPriceIntegrationUpdated]: ProductPriceIntegrationUpdatedEvent['data'];
    [Subjects.ProductStockIntegrationUpdated]: ProductStockIntegrationUpdatedEvent['data'];
    [Subjects.ProductImageIntegrationUpdated]: ProductImageIntegrationUpdatedEvent['data'];
    [Subjects.ProductPriceUpdated]: ProductPriceUpdatedEvent['data'];
    [Subjects.ProductErpIdUpdated]: ProductErpIdUpdatedEvent['data'];
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
    [Subjects.OrderProductUpdated]: OrderProductStockUpdatedEvent['data'];
    [Subjects.EntityDeleted]: EntityDeletedEvent['data'];
    [Subjects.OrderStatusUpdated]: OrderStatusUpdatedEvent['data'];
    [Subjects.ImportImagesFromUrls]: ImportImagesFromUrlsEvent['data'];
    [Subjects.ImportImagesFromUrlsCompleted]: ImportImagesFromUrlsCompletedEvent['data'];
    [Subjects.DeleteProductImages]: DeleteProductImagesEvent['data'];
    [Subjects.DeleteProductImagesCompleted]: DeleteProductImagesCompletedEvent['data'];
    [Subjects.CatalogMappingCreated]: CatalogMappingCreatedEvent['data'];
    [Subjects.ProductIntegrationSynced]: ProductIntegrationSyncedEvent['data'];
    [Subjects.OrderIntegrationCreated]: OrderIntegrationCreatedEvent['data'];
    [Subjects.UserIntegrationSettings]: UserIntegrationSettingsEvent['data'];
    [Subjects.IntegrationCreated]: IntegrationCreatedEvent['data'];
    [Subjects.OrderIntegrationStatusUpdated]: OrderIntegrationStatusUpdatedEvent['data'];
    [Subjects.ProductMatched]: ProductMatchedEvent['data'];
    [Subjects.NotificationCreated]: NotificationCreatedEvent['data'];
    [Subjects.EntityVersionUpdated]: EntityVersionUpdatedEvent['data'];
    [Subjects.SyncRequested]: SyncRequestedEvent['data'];
    [Subjects.InvoiceCreated]: InvoiceCreatedEvent['data'];
    [Subjects.InvoiceUpdated]: InvoiceUpdatedEvent['data'];
    [Subjects.InvoiceFormalized]: InvoiceFormalizedEvent['data'];
    [Subjects.InvoiceFailed]: InvoiceFailedEvent['data'];
}

export interface OutboxAttrs<T extends keyof EventPayloadMap = keyof EventPayloadMap> extends BaseAttrs {
    eventType: T;
    payload: EventPayloadMap[T];
    environment?: 'production' | 'development' | 'test';
    status?: 'pending' | 'processing' | 'published' | 'completed' | 'failed';
    retryCount?: number;
    lastAttempt?: Date;
    error?: string;
    result?: any;
    processedAt?: Date;
}

export interface OutboxDoc extends BaseDoc {
    eventType: string;
    payload: any;
    environment: 'production' | 'development' | 'test';
    status: 'pending' | 'processing' | 'published' | 'completed' | 'failed';
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
    environment: {
        type: String,
        required: true,
        default: () => process.env.NODE_ENV || 'production',
        enum: ['production', 'development', 'test'],
        index: true
    },
    status: {
        type: String,
        required: true,
        default: 'pending',
        enum: ['pending', 'processing' , 'published', 'completed' , 'failed']
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

// Compound index for optimal query performance
// Optimizes: { status: 'pending', environment: 'production', retryCount: { $lt: 5 } }
outboxSchema.index({ status: 1, environment: 1, retryCount: 1, createdAt: 1 });

export function createOutboxModel(connection: mongoose.Connection) {
    try {
        return connection.model<OutboxDoc, OutboxModel>('Outbox');
    } catch {
        return connection.model<OutboxDoc, OutboxModel>('Outbox', outboxSchema);
    }
}