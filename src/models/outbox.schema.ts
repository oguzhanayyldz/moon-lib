import mongoose from "mongoose";
import { BaseAttrs, BaseDoc, BaseModel, createBaseSchema } from "./base/base.schema";
import { logger } from "../services/logger.service";
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
    OrderCargoUpdatedEvent,
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
    IntegrationUpdatedEvent,
    UserIntegrationSettingsEvent,
    OrderIntegrationStatusUpdatedEvent,
    ProductMatchedEvent,
    NotificationCreatedEvent,
    OrderProductStockUpdatedEvent,
    EntityVersionUpdatedEvent,
    EntityVersionBulkUpdatedEvent,
    SyncRequestedEvent,
    InvoiceUpdatedEvent,
    InvoiceCreatedEvent,
    InvoiceFormalizedEvent,
    InvoiceFailedEvent,
    ShipmentCreatedEvent,
    ShipmentUpdatedEvent,
    ExcelFileGeneratedEvent,
    ExcelFileStoredEvent,
    CategoryCreatedEvent,
    CategoryUpdatedEvent,
    BrandCreatedEvent,
    BrandUpdatedEvent,
    CustomerUpdatedEvent,
    CustomerAddressUpdatedEvent,
    CatalogMappingUpdatedEvent,
    PlatformCategorySyncedEvent,
    PlatformBrandSyncedEvent,
    UpdateOrderCargoLabelEvent,
    OrderWorkPackageInfoBulkUpdatedEvent
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
    [Subjects.IntegrationUpdated]: IntegrationUpdatedEvent['data'];
    [Subjects.OrderIntegrationStatusUpdated]: OrderIntegrationStatusUpdatedEvent['data'];
    [Subjects.ProductMatched]: ProductMatchedEvent['data'];
    [Subjects.NotificationCreated]: NotificationCreatedEvent['data'];
    [Subjects.EntityVersionUpdated]: EntityVersionUpdatedEvent['data'];
    [Subjects.EntityVersionBulkUpdated]: EntityVersionBulkUpdatedEvent['data'];
    [Subjects.SyncRequested]: SyncRequestedEvent['data'];
    [Subjects.InvoiceCreated]: InvoiceCreatedEvent['data'];
    [Subjects.InvoiceUpdated]: InvoiceUpdatedEvent['data'];
    [Subjects.InvoiceFormalized]: InvoiceFormalizedEvent['data'];
    [Subjects.InvoiceFailed]: InvoiceFailedEvent['data'];
    [Subjects.OrderCargoUpdated]: OrderCargoUpdatedEvent['data'];
    [Subjects.ShipmentCreated]: ShipmentCreatedEvent['data'];
    [Subjects.ShipmentUpdated]: ShipmentUpdatedEvent['data'];
    [Subjects.ExcelFileGenerated]: ExcelFileGeneratedEvent['data'];
    [Subjects.ExcelFileStored]: ExcelFileStoredEvent['data'];
    [Subjects.CategoryCreated]: CategoryCreatedEvent['data'];
    [Subjects.CategoryUpdated]: CategoryUpdatedEvent['data'];
    [Subjects.BrandCreated]: BrandCreatedEvent['data'];
    [Subjects.BrandUpdated]: BrandUpdatedEvent['data'];
    [Subjects.CustomerUpdated]: CustomerUpdatedEvent['data'];
    [Subjects.CustomerAddressUpdated]: CustomerAddressUpdatedEvent['data'];
    [Subjects.CatalogMappingUpdated]: CatalogMappingUpdatedEvent['data'];
    [Subjects.PlatformCategorySynced]: PlatformCategorySyncedEvent['data'];
    [Subjects.PlatformBrandSynced]: PlatformBrandSyncedEvent['data'];
    [Subjects.UpdateOrderCargoLabel]: UpdateOrderCargoLabelEvent['data'];
    [Subjects.OrderWorkPackageInfoBulkUpdated]: OrderWorkPackageInfoBulkUpdatedEvent['data'];
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
    priority?: number; // 1-5, 1 en yüksek öncelik
    userId?: string; // User-scoped priority için
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
    priority: number; // 1-5, 1 en yüksek öncelik
    userId: string; // User-scoped priority için (_system_ fallback)
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
    },
    priority: {
        type: Number,
        min: 1,
        max: 5,
        index: true
        // NOT: Default yok - pre-save hook'ta hesaplanacak
    },
    userId: {
        type: String,
        index: true
        // NOT: Default yok - pre-save hook'ta hesaplanacak
    }
};

const outboxSchema = createBaseSchema(outboxSchemaDefination);

// Event tipine göre öncelik belirleme
export function getEventPriority(eventType: string): number {
    const PRIORITY_MAP: Record<string, number> = {
        // Priority 1: Core (User) + Delete (silme EN ÖNCELİKLİ!)
        [Subjects.UserCreated]: 1,
        [Subjects.UserUpdated]: 1,
        [Subjects.EntityDeleted]: 1, // Silme işlemi en öncelikli - önce sil, sonra yenisini oluştur
        
        // Priority 2: Primary Entity (Create/Update)
        [Subjects.ProductCreated]: 2,
        [Subjects.ProductUpdated]: 2,
        [Subjects.OrderCreated]: 2,
        [Subjects.OrderUpdated]: 2,
        [Subjects.IntegrationCreated]: 2,
        [Subjects.IntegrationUpdated]: 2,

        
        // Priority 3: Secondary Entity
        [Subjects.CombinationCreated]: 3,
        [Subjects.CombinationUpdated]: 3,
        [Subjects.StockCreated]: 3,
        [Subjects.StockUpdated]: 3,
        [Subjects.CategoryCreated]: 3,
        [Subjects.CategoryUpdated]: 3,
        [Subjects.BrandCreated]: 3,
        [Subjects.BrandUpdated]: 3,
        [Subjects.ProductStockCreated]: 3,
        [Subjects.ProductStockUpdated]: 3,
        
        // Priority 4: Integration Data
        [Subjects.ProductPriceIntegrationUpdated]: 4,
        [Subjects.ProductStockIntegrationUpdated]: 4,
        [Subjects.ProductImageIntegrationUpdated]: 4,
        [Subjects.ProductIntegrationCreated]: 4,
        [Subjects.ProductIntegrationSynced]: 4,
        [Subjects.OrderIntegrationCreated]: 4,
        [Subjects.ProductPriceUpdated]: 4,
        [Subjects.CatalogMappingCreated]: 4,
        [Subjects.CatalogMappingUpdated]: 4,
        
        // Priority 5: Sync/Notification
        [Subjects.EntityVersionUpdated]: 5,
        [Subjects.EntityVersionBulkUpdated]: 5,
        [Subjects.NotificationCreated]: 5,
        [Subjects.SyncRequested]: 5,
    };
    
    return PRIORITY_MAP[eventType] ?? 3;
}

// Payload'dan userId çıkarma
export function extractUserIdFromPayload(payload: any): string {
    // 1. Direkt userId
    if (payload.userId) return payload.userId;
    
    // 2. Direkt user
    if (payload.user) return payload.user;
    
    // 3. list[0].user (ProductCreated, CombinationCreated)
    if (payload.list?.[0]?.user) return payload.list[0].user;
    
    // 4. data içinde (EntityDeleted vb.)
    if (payload.data?.userId) return payload.data.userId;
    if (payload.data?.user) return payload.data.user;
    
    // 5. items içinde
    if (payload.items?.[0]?.userId) return payload.items[0].userId;
    
    // Bulunamazsa _system_ (en yüksek öncelikli)
    return '_system_';
}

// Pre-save hook: priority ve userId her zaman hesapla
outboxSchema.pre('save', function(next) {
    const doc = this as unknown as OutboxDoc;
    if (this.isNew) {
        // Priority'yi eventType'a göre hesapla (her zaman yeniden hesapla)
        doc.priority = getEventPriority(doc.eventType);
        
        // userId'yi payload'dan çıkar (her zaman yeniden hesapla)
        doc.userId = extractUserIdFromPayload(doc.payload);
        
        logger.debug(`Outbox created: eventType=${doc.eventType}, priority=${doc.priority}, userId=${doc.userId}`);
    }
    next();
});

// Compound index for optimal query performance with priority
// _system_ users get processed first, then by priority within each user
outboxSchema.index({ status: 1, environment: 1, userId: 1, priority: 1, creationDate: 1 });
outboxSchema.index({ status: 1, environment: 1, retryCount: 1, creationDate: 1 });

export function createOutboxModel(connection: mongoose.Connection) {
    try {
        return connection.model<OutboxDoc, OutboxModel>('Outbox');
    } catch {
        return connection.model<OutboxDoc, OutboxModel>('Outbox', outboxSchema);
    }
}