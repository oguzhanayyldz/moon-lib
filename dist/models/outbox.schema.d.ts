import mongoose from "mongoose";
import { BaseAttrs, BaseDoc, BaseModel } from "./base/base.schema";
import { Subjects, ProductCreatedEvent, ProductUpdatedEvent, PackageProductLinkCreatedEvent, PackageProductLinkUpdatedEvent, RelationProductLinkCreatedEvent, RelationProductLinkUpdatedEvent, CombinationCreatedEvent, CombinationUpdatedEvent, UserCreatedEvent, UserUpdatedEvent, IntegrationCommandEvent, ProductStockCreatedEvent, ProductStockUpdatedEvent, StockCreatedEvent, StockUpdatedEvent, OrderCreatedEvent, OrderUpdatedEvent, EntityDeletedEvent, OrderStatusUpdatedEvent, IntegrationCommandResultEvent } from "@xmoonx/common";
interface EventPayloadMap {
    [Subjects.ProductCreated]: ProductCreatedEvent['data'];
    [Subjects.ProductUpdated]: ProductUpdatedEvent['data'];
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
}
export interface OutboxAttrs<T extends keyof EventPayloadMap = keyof EventPayloadMap> extends BaseAttrs {
    eventType: T;
    payload: EventPayloadMap[T];
    status: 'pending' | 'published' | 'completed' | 'failed';
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
export interface OutboxModel extends BaseModel<OutboxDoc, OutboxAttrs> {
}
export declare function createOutboxModel(connection: mongoose.Connection): OutboxModel;
export {};
