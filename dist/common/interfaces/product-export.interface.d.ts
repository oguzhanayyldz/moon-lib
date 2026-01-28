import { ResourceName } from '../';
/**
 * Platformlar arası ortak ürün veri modeli
 * Bu model, farklı entegrasyon platformlarına aktarılacak ürün verilerini standartlaştırır.
 */
export interface CommonProductExport {
    id: string;
    externalId?: string;
    name: string;
    description?: string;
    sku: string;
    barcode?: string;
    category?: {
        name: string;
        code?: string;
    };
    price: number;
    listPrice?: number;
    currency: string;
    tax?: number;
    stock?: number;
    images?: Array<{
        url: string;
        main?: boolean;
        order?: number;
    }>;
    variants?: Array<{
        id: string;
        sku: string;
        barcode?: string;
        price?: number;
        stock?: number;
        attributes: Array<{
            name: string;
            value: string;
        }>;
        images?: Array<{
            url: string;
            order?: number;
        }>;
    }>;
    metadata?: Record<string, any>;
}
/**
 * Ürün aktarım isteği için girdi modeli
 */
export interface ProductExportRequest {
    productId: string;
    platform: ResourceName;
    operation: 'create' | 'update';
    platformParams?: Record<string, any>;
}
/**
 * Platformlara fiyat güncelleme isteği modeli
 */
export interface ProductPriceUpdateRequest {
    requestId?: string;
    productId: string;
    externalId: string;
    platform: ResourceName;
    userId: string;
    price?: number;
    listPrice?: number;
    variants?: Array<{
        id: string;
        externalId: string;
        price?: number;
        listPrice?: number;
    }>;
    platformParams?: Record<string, any>;
}
/**
 * Platformlara stok güncelleme isteği modeli
 */
export interface ProductStockUpdateRequest {
    requestId?: string;
    productId: string;
    externalId: string;
    otherExternalId?: string;
    platform: ResourceName;
    userId: string;
    stock?: number;
    variants?: Array<{
        id: string;
        externalId: string;
        stock: number;
    }>;
    platformParams?: Record<string, any>;
}
