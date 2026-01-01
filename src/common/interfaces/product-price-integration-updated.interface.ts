import { CurrencyCode } from "../types/currency-code";
import { ResourceName } from "../types/resourceName";

export interface ProductPriceIntegrationUpdated {
    productId?: string; // Ürün ID'si
    combinationId?: string; // Kombinasyon ID'si
    sku: string;            // Ürün kodu
    barcode?: string | null;      // Barkod
    listPrice?: number;   // Liste fiyatı
    price: number;
    costPrice?: number; // Maliyet fiyatı
    comparePrice?: number; // Karşılaştırma fiyatı
    source?: ResourceName;
    integrationName?: ResourceName;
}

// Fiyat güncelleme stratejileri
export enum PriceUpdateStrategy {
    PRIORITY = "priority",
    LOWEST = "lowest",
    HIGHEST = "highest",
    AVERAGE = "average"
}

// Güncelleme sıklıkları
export enum UpdateFrequency {
    HOURLY = "hourly",
    DAILY = "daily",
    WEEKLY = "weekly",
    MANUAL = "manual"
}

// Fiyat tipleri
export enum PriceType {
    PRICE = "price",
    LIST_PRICE = "listPrice"
}

// Kaynak kuralları
export interface SourceRules {
    minMargin: number;       // Minimum kar marjı (%)
    maxDeviation: number;    // Maksimum sapma (%)
    applyTax: boolean;       // Vergi uygula
}

// Kaynak entegrasyon ayarları
export interface PriceSource {
    integrationId: string;   // Entegrasyon ID
    name: string;            // Entegrasyon adı
    enabled: boolean;        // Aktif/Pasif
    priority: number;        // Öncelik sırası
    priceType: PriceType;    // Fiyat tipi
    applyCurrency: boolean;  // Kur dönüşümü uygula
    targets: PriceTargetIntegration[]; // Hedef entegrasyonlar (ResourceName)
    rules: SourceRules;      // Kaynak kuralları
}

// Gelişmiş ayarlar
export interface AdvancedSettings {
    skipOutOfStock: boolean;     // Stokta olmayan ürünleri atla
    applyToAttributes: string[]; // Özniteliklere uygula (şu an kullanılmıyor)
    updateBothPrices: boolean;   // Her iki fiyatı güncelle (liste+satış)
    notifyChanges: boolean;      // Değişiklikleri bildir
    logHistory: boolean;         // Fiyat geçmişini kaydet
    advancedTargetingMode: boolean; // Gelişmiş hedefleme modu
}

// Ana ayarlar interface'i
export interface PriceUpdateSettings {
    enabled: boolean;                // Aktif/Pasif
    strategy: PriceUpdateStrategy;   // Strateji
    sources: PriceSource[];          // Kaynak entegrasyonlar
    targetIntegrations: PriceTargetIntegration[]; // Hedef entegrasyonlar (ResourceName)
    updateFrequency: UpdateFrequency;  // Güncelleme sıklığı
    updateTime: string;              // Güncelleme saati (HH:MM formatı)
    lastUpdate: string | null;       // Son güncelleme zamanı (ISO string)
    advanced: AdvancedSettings;      // Gelişmiş ayarlar
}

export interface PriceTargetIntegration {
    integrationId: string;   // Entegrasyon ID
    name: ResourceName;      // Entegrasyon adı
    enabled: boolean;        // Aktif/Pasif
}