import { ResourceName } from "../types/resourceName";
export interface ProductPriceIntegrationUpdated {
    productId?: string;
    combinationId?: string;
    sku: string;
    barcode?: string | null;
    listPrice?: number;
    price: number;
    costPrice?: number;
    comparePrice?: number;
    source?: ResourceName;
    integrationName?: ResourceName;
}
export declare enum PriceUpdateStrategy {
    PRIORITY = "priority",
    LOWEST = "lowest",
    HIGHEST = "highest",
    AVERAGE = "average"
}
export declare enum UpdateFrequency {
    HOURLY = "hourly",
    DAILY = "daily",
    WEEKLY = "weekly",
    MANUAL = "manual"
}
export declare enum PriceType {
    PRICE = "price",
    LIST_PRICE = "listPrice"
}
export interface SourceRules {
    minMargin: number;
    maxDeviation: number;
    applyTax: boolean;
}
export interface PriceSource {
    integrationId: string;
    name: string;
    enabled: boolean;
    priority: number;
    priceType: PriceType;
    applyCurrency: boolean;
    targets: PriceTargetIntegration[];
    rules: SourceRules;
}
export interface AdvancedSettings {
    skipOutOfStock: boolean;
    applyToAttributes: string[];
    updateBothPrices: boolean;
    notifyChanges: boolean;
    logHistory: boolean;
    advancedTargetingMode: boolean;
}
export interface PriceUpdateSettings {
    enabled: boolean;
    strategy: PriceUpdateStrategy;
    sources: PriceSource[];
    targetIntegrations: PriceTargetIntegration[];
    updateFrequency: UpdateFrequency;
    updateTime: string;
    lastUpdate: string | null;
    advanced: AdvancedSettings;
}
export interface PriceTargetIntegration {
    integrationId: string;
    name: ResourceName;
    enabled: boolean;
}
