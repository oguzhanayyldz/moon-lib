import { ResourceName } from '../types/resourceName';
import { IntegrationStatus } from '../types/integration-status';
import { Subjects } from './subjects';

export interface CatalogMappingCreatedEventData {
    id: string;
    uuid: string;
    user: string;
    product: string;
    combination?: string;
    integrationName: ResourceName;
    integrationData: {
        id: string;
        status: IntegrationStatus;
        lastSyncedAt: Date;
        mappings: Record<string, string>;
        metadata: Record<string, any>;
        parentId?: string;
        variantId?: string;
        platformCustomSku?: string;
        platformCustomBarcode?: string;
    };
    isVariant: boolean;
    parentMapping?: string;
    price: number;
    listPrice?: number;
    priceVersion: number;
    priceUpdateTimestamp: Date;
    priceSource?: string;
    version: number;
}

export interface CatalogMappingCreatedEvent {
    subject: Subjects.CatalogMappingCreated;
    data: { list: CatalogMappingCreatedEventData[] };
} 