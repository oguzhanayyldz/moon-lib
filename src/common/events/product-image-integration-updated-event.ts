import { Subjects } from "./subjects";
import { ResourceName } from "../types/resourceName";
import { ProductImageIntegrationUpdated } from "../interfaces/product-image-integration-updated.interface";
import { ProductUpdateConfiguration } from "./product-integration-created-event";

export interface ProductImageIntegrationUpdatedEvent {
    subject: Subjects.ProductImageIntegrationUpdated;
    data: {
        requestId: string;
        userId: string;
        data: ProductImageIntegrationUpdated[];
        source?: ResourceName;
        updateConfiguration?: ProductUpdateConfiguration;
        timestamp?: Date;
    }
}