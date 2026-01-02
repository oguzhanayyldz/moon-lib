import { IntegrationStatus } from "../types/integration-status";
import { ResourceName } from "../types/resourceName";
import { Subjects } from "./subjects";

export interface CatalogMappingUpdated {
    id: string;
    uuid: string;
    user: string;
    product: string;
    combination?: string;
    version: number;
    integrationName: ResourceName;
    integrationData: {
        id?: string;
        status: IntegrationStatus;
        lastSyncedAt: Date;
        mappings?: Record<string, string>;
        metadata?: Record<string, any>;
        attributeValues?: Record<string, any>;
        parentId?: string;
        variantId?: string;
        platformCustomSku?: string;
        platformCustomBarcode?: string;
    };
    isVariant: boolean;
    parentMapping?: string;
    name?: string;
    description?: string;
    price: number;
    listPrice?: number;
    priceVersion: number;
    priceUpdateTimestamp: Date;
    priceSource?: string;
    uniqueCode?: string | null;
    deleted?: boolean;
    deletionDate?: Date | null;
}

// Alias export for consistency with CatalogMappingCreatedEventData naming pattern
export type CatalogMappingUpdatedEventData = CatalogMappingUpdated;

export interface CatalogMappingUpdatedEvent {
    subject: Subjects.CatalogMappingUpdated;
    data: {
        list: CatalogMappingUpdatedEventData[];
    };
}
