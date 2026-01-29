import { Subjects } from "./subjects";
export interface SupportedAction {
    action: 'SYNC_ORDERS' | 'SYNC_PRODUCTS' | 'FETCH_IMAGES' | 'SYNC_BRANDS' | 'SYNC_CATEGORIES' | 'SYNC_ATTRIBUTES' | 'SYNC_ORDER_STATUSES' | 'MATCH_PRODUCTS' | 'FETCH_STOCKS' | 'FETCH_PRICES' | 'UPDATE_STOCK' | 'UPDATE_PRICE' | 'CREATE_INVOICE' | 'SEND_PRODUCTS' | 'FORMALIZE_ORDERS' | 'FETCH_PDF_LINKS' | 'FETCH_TRACKING_BULK' | 'CREATE_SHIPMENT_BULK' | 'FETCH_LOCATIONS';
    enabled: boolean;
    parameters?: any[];
}
/**
 * AutomationTrigger - Tetikleme tipi
 */
export declare enum ShipmentAutomationTrigger {
    STATUS_CHANGE = "STATUS_CHANGE",
    SCHEDULED = "SCHEDULED",
    MANUAL = "MANUAL"
}
/**
 * ScheduleFrequency - Zamanlama sıklığı
 */
export declare enum ShipmentScheduleFrequency {
    MINUTE = "minute",
    HOURLY = "hourly",
    DAILY = "daily",
    WEEKLY = "weekly"
}
/**
 * ShipmentSettingsSource - Platform ↔ Kargo eşleştirmesi
 */
export interface ShipmentSettingsSource {
    integrationId: string;
    name: string;
    enabled: boolean;
    cargoIntegrationId?: string;
    cargoName?: string;
    autoSendOnOrderCreated?: boolean;
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
    targetOrderStatus?: string;
    scheduleFrequency?: ShipmentScheduleFrequency;
    scheduleValue?: string;
    scheduledTime?: string;
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
    useIntegrationCargoLabel: boolean;
    senderInfo?: ShipmentSenderInfo;
    sources: ShipmentSettingsSource[];
    fallbackCargoIntegrationId?: string;
    fallbackCargoName?: string;
    shipmentCreation?: ShipmentJobConfig;
    labelPrint?: ShipmentJobConfig;
    trackingUpdate?: ShipmentJobConfig;
    platformTrackingSync?: ShipmentJobConfig;
    minOrderAmount?: number;
    maxOrderAmount?: number;
    statistics?: ShipmentStatistics;
    lastUpdate?: Date | string | null;
    /** Bu entegrasyon için shipment ayarları aktif mi (runtime'da hesaplanır) */
    enabledForThisIntegration?: boolean;
    /** Bu entegrasyon için eşleşen source bilgisi (runtime'da hesaplanır) */
    currentSource?: ShipmentSettingsSource | null;
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
    integration: string | null;
    credentials: {
        [key: string]: string;
    };
    active: boolean;
    lastSync?: Date;
    supportedActions?: SupportedAction[];
    uniqueCode?: string | null;
    creationDate?: Date;
    updatedOn?: Date;
    deleted?: boolean;
    deletionDate?: Date | null;
}
