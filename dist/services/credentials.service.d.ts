/**
 * CredentialsService - Credentials Merge & Parse Utility
 *
 * Bu servis, BASE ve Integration credentials'ını birleştirip parse eden merkezi utility'dir.
 * Tüm settings'lerin (productUpdate, price_update_settings, stock_update_settings,
 * order_update_settings, shipment_settings) tek bir yerden yönetilmesini sağlar.
 *
 * @example
 * ```typescript
 * const credentials = CredentialsService.mergeAndParse(
 *     baseSettings?.credentials || null,
 *     userSettings.credentials,
 *     integration.id,
 *     integration.name,
 *     integration.type as IntegrationType
 * );
 * ```
 */
import { IntegrationType } from '../common/types/integration-type';
export interface ParsedShipmentSettings {
    enabled: boolean;
    useIntegrationCargoLabel: boolean;
    senderInfo?: any;
    sources: any[];
    enabledForThisIntegration?: boolean;
    currentSource?: any;
    fallbackCargoIntegrationId?: string;
    fallbackCargoName?: string;
}
export interface ParsedOrderUpdateSettings {
    enable: boolean;
    sources: any[];
}
export interface ParsedPriceUpdateSettings {
    enable: boolean;
    sources: any[];
}
export interface ParsedStockUpdateSettings {
    enabled: boolean;
    sources: any[];
}
export interface ParsedCredentials {
    [key: string]: any;
    productUpdate?: any;
    price_update_settings?: ParsedPriceUpdateSettings;
    stock_update_settings?: ParsedStockUpdateSettings;
    order_update_settings?: ParsedOrderUpdateSettings;
    shipment_settings?: ParsedShipmentSettings;
    shipmentEnabled?: boolean;
    useIntegrationCargoLabel?: boolean;
    customCargoIntegrationId?: string | null;
    customCargoName?: string | null;
    autoSendToCustomCargo?: boolean;
    shipmentSenderInfo?: any;
    fallbackCargoIntegrationId?: string | null;
    fallbackCargoName?: string | null;
    syncOrderStatus?: boolean;
    syncCancelledOrders?: boolean;
    syncReturnedOrders?: boolean;
    integration_active?: boolean;
    user?: string;
    platform?: string;
}
export declare class CredentialsService {
    /**
     * BASE ve Integration credentials'ı birleştirir ve parse eder
     *
     * @param baseCredentials - BASE kaydından gelen credentials (Map veya Object)
     * @param integrationCredentials - Entegrasyon kaydından gelen credentials (Map veya Object)
     * @param integrationId - Entegrasyon ID (filtering için)
     * @param integrationName - Entegrasyon adı (filtering için)
     * @param integrationType - 'marketplace' | 'ecommerce' | 'cargo'
     * @returns ParsedCredentials - Merge edilmiş ve parse edilmiş credentials
     */
    static mergeAndParse(baseCredentials: Map<string, string> | Record<string, any> | null, integrationCredentials: Map<string, string> | Record<string, any>, integrationId: string, integrationName: string, integrationType: IntegrationType): ParsedCredentials;
    /**
     * Map veya Object'i Object'e çevirir
     */
    static toObject(data: Map<string, any> | Record<string, any> | null): Record<string, any>;
    /**
     * Güvenli JSON parse
     */
    static safeJsonParse(value: string | any): any;
    /**
     * Price update settings parse ve filter
     */
    private static parsePriceUpdateSettings;
    /**
     * Stock update settings parse ve filter
     */
    private static parseStockUpdateSettings;
    /**
     * Order update settings parse ve filter
     */
    private static parseOrderUpdateSettings;
    /**
     * Shipment settings parse ve filter
     */
    private static parseShipmentSettings;
}
