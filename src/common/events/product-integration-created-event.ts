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
    }
}

// Ürün güncelleme konfigürasyonu
export interface ProductUpdateConfiguration {
    enabled: boolean;
    source: string;  // Hangi platform için güncelleme yapılacak
    cdnStrategy?: 'platform' | 'own';  // Görsel depolama stratejisi (varsayılan: 'platform')
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