import { CurrencyCode } from "../types/currency-code";
import { UnitType } from "../types/unit-type";
import { Subjects } from "./subjects";
import { ProductStatus } from "./types/product-status";
import { ProductType } from "./types/product-type";
import { FixStatus } from '../types/fix-status';
import { AttributesType } from '../types/attributes-type';
import { ResourceName } from '../types/resourceName';

export interface ProductCreatedEvent {
    subject: Subjects.ProductCreated;
    data: ProductCreatedEventData;
}

export interface ProductCreatedEventData {
    list: ProductCreatedEventDataListItem[];
}

// Ürün görseli için basit ara yüz
export interface ProductImageInfo {
    url: string;      // Görsel URL'i
    isMain?: boolean; // Ana görsel mi?
    sort?: number;    // Sıralama
}

// Kategori bilgisi için basit arayüz
export interface ProductCategoryInfo {
    id: string;       // Kategori ID'si
    name: string;     // Kategori adı
    code?: string;    // Kategori kodu (varsa)
}

export interface ProductBrandInfo {
    id: string;
    name: string;
    code?: string;
}

export interface ProductCreatedEventDataListItem {
    id: string;
    uuid: string;
    user: string;
    version: number;
    barcode: string | null;
    sku: string;
    name: string;
    description: string;
    image: string;
    currency: CurrencyCode;
    tax: number;
    status: ProductStatus;
    type: ProductType;
    unitType: UnitType;
    erpId?: string | null;
    erpPlatform?: string | null; // ERP platform adı (Parasut, Logo, Netsis...)
    combinations?: ProductCreatedEventDataListItemCombination[];
    packages?: ProductCreatedEventDataListItemPackage[];
    related?: ProductCreatedEventDataListItemRelated;
    uniqueCode?: string | null;
    creationDate?: Date;
    updatedOn?: Date;
    source?: ResourceName;
    sourceData?: Record<string, any>;
    // Ürün görselleri (çoklu)
    images?: ProductImageInfo[];
    // Kategori bilgisi
    brand?: ProductBrandInfo;
    category?: ProductCategoryInfo;
}

export interface ProductCreatedEventDataListItemCombination {
    id: string;
    uuid: string;
    user: string;
    version: number;
    barcode: string;
    sku: string;
    status: FixStatus;
    erpId?: string | null;
    erpPlatform?: string | null; // ERP platform adı (Parasut, Logo, Netsis...)
    sort?: number | null;
    attributes?: AttributesType;
    uniqueCode?: string | null;
    action?: 'create' | 'update';
    source?: ResourceName;
    sourceData?: Record<string, any>;
    // Varyant görselleri (çoklu)
    images?: ProductImageInfo[];
}

export interface ProductCreatedEventDataListItemPackage {
    id: string;
    uuid: string;
    user: string;
    version: number;
    quantity: number;
    price: number;
    status: FixStatus;
    product: string;
    packageProduct: string;
    uniqueCode?: string | null;
    action?: 'create' | 'update';
}

export interface ProductCreatedEventDataListItemRelated {
    id: string;
    uuid: string;
    user: string;
    version: number;
    product: string;
    relatedProduct: string;
    uniqueCode?: string | null;
}