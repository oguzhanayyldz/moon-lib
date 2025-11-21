import { Subjects } from "./subjects";
import { ProductStatus } from "./types/product-status";
import { ProductType } from "./types/product-type";
import { UnitType } from "../types/unit-type";
import { CurrencyCode } from "../types/currency-code";
import { FixStatus } from '../types/fix-status';
import { AttributesType } from '../types/attributes-type';
import { ResourceName } from '../types/resourceName';
import { ProductImageInfo, ProductCategoryInfo, ProductBrandInfo } from "./product-created-event";
export interface ProductUpdatedEvent {
    subject: Subjects.ProductUpdated;
    data: ProductUpdatedEventData;
}
export interface ProductUpdatedEventData {
    list: ProductUpdatedEventDataListItem[];
}
export interface ProductUpdatedEventDataListItem {
    id: string;
    uuid: string;
    user: string;
    version: number;
    barcode: string | null;
    sku: string;
    name: string;
    image: string;
    description: string;
    currency: CurrencyCode;
    tax: number;
    status: ProductStatus;
    type: ProductType;
    unitType: UnitType;
    combinations?: ProductUpdatedEventDataListItemCombination[];
    packages?: ProductUpdatedEventDataListItemPackage[];
    related?: ProductUpdatedEventDataListItemRelated;
    erpId?: string | null;
    erpPlatform?: string | null;
    uniqueCode?: string | null;
    deleted?: boolean;
    deletionDate?: Date | null;
    source?: ResourceName;
    sourceData?: Record<string, any>;
    images?: ProductImageInfo[];
    brand?: ProductBrandInfo;
    category?: ProductCategoryInfo;
}
export interface ProductUpdatedEventDataListItemCombination {
    id: string;
    uuid: string;
    user: string;
    version: number;
    barcode: string;
    sku: string;
    status: FixStatus;
    erpId?: string | null;
    erpPlatform?: string | null;
    sort?: number | null;
    attributes?: AttributesType;
    deleted?: boolean;
    deletionDate?: Date | null;
    uniqueCode?: string | null;
    action?: 'create' | 'update';
    source?: ResourceName;
    sourceData?: Record<string, any>;
    images?: ProductImageInfo[];
}
export interface ProductUpdatedEventDataListItemPackage {
    id: string;
    uuid: string;
    user: string;
    version: number;
    quantity: number;
    price: number;
    status: FixStatus;
    deleted?: boolean;
    deletionDate?: Date | null;
    product: string;
    packageProduct: string;
    uniqueCode?: string | null;
    action?: 'create' | 'update';
}
export interface ProductUpdatedEventDataListItemRelated {
    id: string;
    uuid: string;
    user: string;
    version: number;
    deleted?: boolean;
    deletionDate?: Date | null;
    product: string;
    relatedProduct: string;
    uniqueCode?: string | null;
}
