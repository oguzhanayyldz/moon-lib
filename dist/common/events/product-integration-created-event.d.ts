import { Subjects } from "./subjects";
import { ProductIntegrationCreated } from '../interfaces/product-integration-created.interface';
import { ResourceName } from "../types/resourceName";
export interface ProductIntegrationCreatedEvent {
    subject: Subjects.ProductIntegrationCreated;
    data: {
        requestId: string;
        userId: string;
        products: ProductIntegrationCreated[];
        source?: ResourceName;
        updateConfiguration?: ProductUpdateConfiguration;
        timestamp?: Date;
    };
}
export interface ProductUpdateConfiguration {
    enabled: boolean;
    source: string;
    fields: {
        name: boolean;
        description: boolean;
        price: boolean;
        listPrice: boolean;
        tax: boolean;
        barcode: boolean;
        sku: boolean;
        status: boolean;
        images: boolean;
        combinations: boolean;
        category: boolean;
        brand: boolean;
    };
}
