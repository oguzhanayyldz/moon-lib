export interface ProductStockIntegrationUpdated {
    sku: string;
    barcode?: string;
    quantity: number;
    warehouseId: string;
    shelfId?: string;
    combinationId?: string;
    productId?: string;
}

// Güncelleme sıklıkları
export enum StockUpdateFrequency {
    MINUTE = "minute",
    HOURLY = "hourly",
    DAILY = "daily",
    WEEKLY = "weekly",
    MANUAL = "manual"
}

// Kaynak kuralları
export interface StockSourceRules {
    minQuantity: number;
        maxQuantity: number;
}

// Kaynak entegrasyon ayarları
export interface StockSource {
    integrationId: string;
    name: string;
    enabled: boolean;
    sourceLocationId?: string | null;  // 🆕 Entegrasyon tarafındaki source location ID (opsiyonel, null = tüm lokasyonlar)
    warehouseId: string;               // TARGET: Moon sistemindeki hedef depo
    shelfId: string | null;            // TARGET: Moon sistemindeki hedef raf
    rules: StockSourceRules;
}

// Gelişmiş ayarlar
export interface StockAdvancedSettings {
    partialStockUpdate: boolean;
    partialStockPercentage: number;
    overrideExistingStock: boolean;
    notifyChanges: boolean;
    logHistory: boolean;
}

export interface StockUpdateSettings {
    enabled: boolean;
    sources: StockSource[];
    updateFrequency: StockUpdateFrequency;
    updateTime: string | number;
    lastUpdate: string | null;
    advanced: StockAdvancedSettings
}