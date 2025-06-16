import { Subjects } from "./subjects";
import { ResourceName } from "../types/resourceName";
import { ProductStockIntegrationUpdated, StockUpdateSettings } from '../interfaces/product-stock-integration-updated.interface';

export interface ProductStockIntegrationUpdatedEvent {
    subject: Subjects.ProductStockIntegrationUpdated;
    data: {
        requestId: string;
        userId: string;
        data: ProductStockIntegrationUpdated[];
        source?: ResourceName;
        updateConfiguration?: StockUpdateSettings;
        timestamp?: Date;
    }
}