import { ProductIntegrationImage } from "./product-integration-created.interface";

export interface ProductImageIntegrationUpdated {
    sku: string;
    barcode?: string;
    images: ProductIntegrationImage[];
    combinationId?: string;
    productId?: string;
}