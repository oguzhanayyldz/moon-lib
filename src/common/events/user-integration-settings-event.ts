import { Subjects } from "./subjects";

export interface SupportedAction {
    action: 'SYNC_ORDERS' | 'SYNC_PRODUCTS' | 'FETCH_IMAGES' | 'SYNC_BRANDS' | 'SYNC_CATEGORIES' | 'SYNC_ATTRIBUTES' | 'SYNC_ORDER_STATUSES' | 'MATCH_PRODUCTS' | 'FETCH_STOCKS' | 'FETCH_PRICES' | 'UPDATE_STOCK' | 'UPDATE_PRICE' | 'CREATE_INVOICE' | 'SEND_PRODUCTS' | 'FORMALIZE_ORDERS' | 'FETCH_PDF_LINKS' | 'FETCH_TRACKING_BULK' | 'CREATE_SHIPMENT_BULK' | 'FETCH_LOCATIONS';
    enabled: boolean;
    parameters?: any[];
}

// =====================================
// Shipment Settings Types
// =====================================

/**
 * AutomationTrigger - Tetikleme tipi
 */
export enum ShipmentAutomationTrigger {
    STATUS_CHANGE = 'STATUS_CHANGE',
    SCHEDULED = 'SCHEDULED',
    MANUAL = 'MANUAL',
}

/**
 * ScheduleFrequency - Zamanlama sıklığı
 */
export enum ShipmentScheduleFrequency {
    MINUTE = 'minute',
    HOURLY = 'hourly',
    DAILY = 'daily',
    WEEKLY = 'weekly',
}

/**
 * ShipmentSettingsSource - Platform ↔ Kargo eşleştirmesi
 */
export interface ShipmentSettingsSource {
    integrationId: string;           // Platform integration ID (Trendyol, Hepsiburada, Shopify)
    name: string;                    // Platform adı
    enabled: boolean;                // Bu platform için aktif mi
    cargoIntegrationId?: string;     // Hedef kargo integration ID (Aras, MNG, Yurtiçi)
    cargoName?: string;              // Kargo adı
    autoSendOnOrderCreated?: boolean; // Sipariş geldiğinde otomatik kargo gönder
}

/**
 * SenderInfo - Gönderici bilgileri (panel etiketi için)
 */
export interface ShipmentSenderInfo {
    name?: string;
    address?: string;
    phone?: string;
}

/**
 * JobConfig - Genel job yapılandırması
 */
export interface ShipmentJobConfig {
    enabled: boolean;
    trigger?: ShipmentAutomationTrigger;
    targetOrderStatus?: string;          // STATUS_CHANGE için hedef status
    scheduleFrequency?: ShipmentScheduleFrequency;
    scheduleValue?: string;              // Dakika/saat sayısı veya HH:MM
    scheduledTime?: string;              // Hesaplanan cron expression
}

/**
 * JobStatistics - Job istatistikleri
 */
export interface ShipmentJobStatistics {
    totalProcessed: number;
    totalSuccess: number;
    totalFailed: number;
    lastRunAt?: Date | string | null;
    lastRunStatus?: 'SUCCESS' | 'FAILED' | 'PARTIAL' | null;
}

/**
 * ShipmentStatistics - Tüm job istatistikleri
 */
export interface ShipmentStatistics {
    shipmentCreation?: ShipmentJobStatistics;
    labelPrint?: ShipmentJobStatistics;
    trackingUpdate?: ShipmentJobStatistics;
    platformTrackingSync?: ShipmentJobStatistics;
}

/**
 * ShipmentSettings - Ana ayarlar objesi
 * UserIntegrationSettings.credentials.get('shipment_settings') içinde JSON olarak saklanır
 *
 * NOT: enabledForThisIntegration ve currentSource alanları runtime'da
 * Integration Service tarafından parse sırasında eklenir.
 */
export interface ShipmentSettings {
    enabled: boolean;

    // Etiket Kaynağı: true = platform API, false = panel etiketi
    useIntegrationCargoLabel: boolean;

    // Panel etiketi için gönderici bilgileri
    senderInfo?: ShipmentSenderInfo;

    // Platform ↔ Kargo eşleştirmeleri
    sources: ShipmentSettingsSource[];

    // Fallback kargo (eşleşme bulunamazsa)
    fallbackCargoIntegrationId?: string;
    fallbackCargoName?: string;

    // Job Scheduling
    shipmentCreation?: ShipmentJobConfig;
    labelPrint?: ShipmentJobConfig;
    trackingUpdate?: ShipmentJobConfig;
    platformTrackingSync?: ShipmentJobConfig;

    // Filtreleme koşulları
    minOrderAmount?: number;
    maxOrderAmount?: number;

    // İstatistikler
    statistics?: ShipmentStatistics;

    // Son güncelleme zamanı
    lastUpdate?: Date | string | null;

    // ===== RUNTIME-PARSED FIELDS =====
    // Bu alanlar Integration Service tarafından credential parsing sırasında eklenir
    // Her entegrasyon için özel değerler hesaplanır

    /** Bu entegrasyon için shipment ayarları aktif mi (runtime'da hesaplanır) */
    enabledForThisIntegration?: boolean;

    /** Bu entegrasyon için eşleşen source bilgisi (runtime'da hesaplanır) */
    currentSource?: ShipmentSettingsSource | null;
}

// =====================================
// Invoice Settings Types
// =====================================

/**
 * InvoiceAutomationTrigger - Fatura otomasyon tetikleme tipi
 */
export enum InvoiceAutomationTrigger {
    STATUS_CHANGE = 'STATUS_CHANGE',
    SCHEDULED = 'SCHEDULED',
    MANUAL = 'MANUAL',
    INVOICE_FORMALIZATION = 'INVOICE_FORMALIZATION',
}

/**
 * InvoiceScheduleFrequency - Fatura zamanlama sıklığı
 */
export enum InvoiceScheduleFrequency {
    MINUTE = 'minute',
    HOURLY = 'hourly',
    DAILY = 'daily',
    WEEKLY = 'weekly',
}

/**
 * InvoiceSettingsSource - Platform → ERP eşleştirmesi
 */
export interface InvoiceSettingsSource {
    integrationId: string;      // Kaynak platform integration ID (Trendyol, Shopify, etc.)
    name: string;               // Platform adı
    erpIntegrationId: string;   // Hedef ERP integration ID (Parasut, Logo, etc.)
    erpName: string;            // ERP adı
    enabled: boolean;           // Bu mapping aktif mi
}

/**
 * InvoiceJobConfig - Fatura job yapılandırması
 */
export interface InvoiceJobConfig {
    enabled: boolean;
    trigger?: InvoiceAutomationTrigger;
    targetOrderStatus?: string;              // STATUS_CHANGE için hedef order status
    scheduleFrequency?: InvoiceScheduleFrequency;
    scheduleValue?: string;                  // Dakika/saat sayısı veya HH:MM
    scheduledTime?: string;                  // Hesaplanan cron expression
}

/**
 * InvoiceJobStatistics - Job istatistikleri
 */
export interface InvoiceJobStatistics {
    totalProcessed: number;
    totalSuccess: number;
    totalFailed: number;
    lastRunAt?: Date | string | null;
    lastRunStatus?: 'SUCCESS' | 'FAILED' | 'PARTIAL' | null;
}

/**
 * InvoiceStatistics - Tüm fatura job istatistikleri
 */
export interface InvoiceStatistics {
    invoiceCreation?: InvoiceJobStatistics;
    formalization?: InvoiceJobStatistics;
    pdfFetch?: InvoiceJobStatistics;
}

/**
 * InvoiceSettings - Ana fatura ayarları objesi
 * UserIntegrationSettings.credentials.get('invoice_settings') içinde JSON olarak saklanır
 *
 * NOT: enabledForThisIntegration ve currentSource alanları runtime'da
 * Integration Service tarafından parse sırasında eklenir.
 */
export interface InvoiceSettings {
    enabled: boolean;

    // Platform → ERP eşleştirmeleri
    sources: InvoiceSettingsSource[];

    // Otomatik resmileştirme (fatura oluşturulduğu anda hemen ERP'de resmileştir)
    autoFormalize?: boolean;

    // Fatura Oluşturma Job Ayarları
    invoiceCreation?: InvoiceJobConfig;

    // Fatura Resmileştirme Job Ayarları (ayrı süreç)
    formalization?: InvoiceJobConfig;

    // PDF Çekme Job Ayarları
    pdfFetch?: InvoiceJobConfig;

    // Filtreleme koşulları
    minOrderAmount?: number;
    maxOrderAmount?: number;

    // İstatistikler
    statistics?: InvoiceStatistics;

    // Son güncelleme zamanı
    lastUpdate?: Date | string | null;

    // ===== RUNTIME-PARSED FIELDS =====
    // Bu alanlar Integration Service tarafından credential parsing sırasında eklenir
    // Her entegrasyon için özel değerler hesaplanır

    /** Bu entegrasyon için invoice ayarları aktif mi (runtime'da hesaplanır) */
    enabledForThisIntegration?: boolean;

    /** Bu entegrasyon için eşleşen source bilgisi (runtime'da hesaplanır) */
    currentSource?: InvoiceSettingsSource | null;
}

export interface UserIntegrationSettingsEvent {
    subject: Subjects.UserIntegrationSettings;
    data: {
        list: UserIntegrationSettingsData[];
    };
}

export interface UserIntegrationSettingsData {
    id: string;
    uuid: string;
    user: string;
    version: number;
    integration: string | null; // null = BASE kayıt (global settings)
    credentials: { [key: string]: string };
    active: boolean;
    lastSync?: Date;
    supportedActions?: SupportedAction[];
    uniqueCode?: string | null;
    creationDate?: Date;
    updatedOn?: Date;
    deleted?: boolean;
    deletionDate?: Date | null;
}