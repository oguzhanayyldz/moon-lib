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
    enabled: boolean;
    sources: any[];
}
export interface ParsedPriceUpdateSettings {
    enabled: boolean;
    sources: any[];
}
export interface ParsedStockUpdateSettings {
    enabled: boolean;
    sources: any[];
}
/**
 * Stok/fiyat GÖNDERİM (push) ayarı — BASE `stock_push_settings` / `price_push_settings`.
 * Varsayılan AÇIK: anahtar yok, JSON bozuk ya da entegrasyon listede yoksa `enabled: true`
 * (çekme ayarlarının "yoksa false" kuralının bilinçli TERSİ — geriye dönük uyum).
 */
export interface ParsedStockPushSettings {
    enabled: boolean;
    sources: any[];
}
export interface ParsedPricePushSettings {
    enabled: boolean;
    sources: any[];
}
export interface ParsedInvoiceSettings {
    enabled: boolean;
    sources: any[];
    autoFormalize?: boolean;
    invoiceCreation?: any;
    formalization?: any;
    pdfFetch?: any;
    minOrderAmount?: number;
    maxOrderAmount?: number;
    enabledForThisIntegration?: boolean;
    currentSource?: any;
    printFromErp?: boolean;
    printWaitTimeout?: number;
    sellerInfo?: {
        name?: string;
        address?: string;
        phone?: string;
        taxNumber?: string;
    };
}
export interface ParsedCredentials {
    [key: string]: any;
    productUpdate?: any;
    price_update_settings?: ParsedPriceUpdateSettings;
    stock_update_settings?: ParsedStockUpdateSettings;
    order_update_settings?: ParsedOrderUpdateSettings;
    shipment_settings?: ParsedShipmentSettings;
    invoice_settings?: ParsedInvoiceSettings;
    stockPushEnabled?: boolean;
    pricePushEnabled?: boolean;
    shipmentEnabled?: boolean;
    useIntegrationCargoLabel?: boolean;
    customCargoIntegrationId?: string | null;
    customCargoName?: string | null;
    autoSendToCustomCargo?: boolean;
    shipmentSenderInfo?: any;
    fallbackCargoIntegrationId?: string | null;
    fallbackCargoName?: string | null;
    invoiceEnabled?: boolean;
    invoiceAutoFormalize?: boolean;
    invoiceErpIntegrationId?: string | null;
    invoiceErpName?: string | null;
    invoicePrintFromErp?: boolean;
    invoicePrintWaitTimeout?: number;
    invoiceSellerInfo?: {
        name?: string;
        address?: string;
        phone?: string;
        taxNumber?: string;
    };
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
     * Source eşleşmesi — yeni `integrationName` veya eski `name` field'ına bakar.
     * UI migration sırasında her iki field da kullanımda olabilir.
     */
    private static matchesIntegration;
    /**
     * Gönderim (push) ayarı parse — çekme parse'ının TERSİ varsayılanla: eşleşen kaynak yoksa,
     * anahtar yoksa ya da JSON bozuksa `enabled: true`. Yalnız eşleşen kaynakta `enabled === false`
     * ise kapalı. Eşleşme çekme ile aynı: integrationId öncelikli, yoksa ad.
     */
    private static parsePushSettings;
    static parseStockPushSettings(raw: string | any, integrationName: string, integrationId?: string): ParsedStockPushSettings;
    static parsePricePushSettings(raw: string | any, integrationName: string, integrationId?: string): ParsedPricePushSettings;
    /** Stok gönderimi açık mı? `stockPushEnabled` alanı yoksa (eski payload) true. */
    static isStockPushEnabled(credentials: {
        stockPushEnabled?: boolean;
    } | null | undefined): boolean;
    /** Fiyat gönderimi açık mı? `pricePushEnabled` alanı yoksa (eski payload) true. */
    static isPricePushEnabled(credentials: {
        pricePushEnabled?: boolean;
    } | null | undefined): boolean;
    /**
     * BASE credentials'tan (ham Map/Object) bir entegrasyon için gönderim kapılarını çözer.
     * Router ve catalog, mergeAndParse çalıştırmadan karar verebilsin diye.
     */
    static resolvePushSettings(baseCredentials: Map<string, string> | Record<string, any> | null | undefined, integrationId: string | undefined, integrationName: string): {
        stockPushEnabled: boolean;
        pricePushEnabled: boolean;
    };
    /**
     * Price update settings parse ve filter
     *
     * Top-level `enabled` master switch'i; bu integration için fetchPrices aktif olup
     * olmadığı sources içerisindeki match olan kaynağın `enabled` field'ında. Parse
     * sonrası `enabled` field'ı bu integration için doğru değeri verir, böylece her
     * entegrasyon servisi tek bir field'a bakarak source-level karar verir.
     */
    private static parsePriceUpdateSettings;
    /**
     * Stock update settings parse ve filter
     *
     * `enabled` field'ı bu integration'a ait source.enabled değeriyle override edilir.
     * Issue #560: master `enabled: true` + WC source `enabled: false` durumunda updateStocks
     * skip ediliyordu çünkü parse sonrası master flag aynen geçiyordu.
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
    /**
     * Invoice settings parse ve filter
     */
    private static parseInvoiceSettings;
}
//# sourceMappingURL=credentials.service.d.ts.map