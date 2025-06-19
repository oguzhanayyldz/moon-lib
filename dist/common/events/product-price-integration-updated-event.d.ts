import { Subjects } from "./subjects";
import { ResourceName } from "../types/resourceName";
import { PriceUpdateSettings, ProductPriceIntegrationUpdated } from "../interfaces/product-price-integration-updated.interface";
export interface ProductPriceIntegrationUpdatedEvent {
    subject: Subjects.ProductPriceIntegrationUpdated;
    data: {
        requestId: string;
        userId: string;
        data: ProductPriceIntegrationUpdated[];
        source?: ResourceName;
        integrationName?: ResourceName;
        updateConfiguration?: PriceUpdateSettings;
        timestamp?: Date;
    };
}
