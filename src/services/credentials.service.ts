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

import { logger } from './logger.service';
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
    // Integration-specific fields (API keys, etc.)
    [key: string]: any;

    // Parsed global settings
    productUpdate?: any;
    price_update_settings?: ParsedPriceUpdateSettings;
    stock_update_settings?: ParsedStockUpdateSettings;
    order_update_settings?: ParsedOrderUpdateSettings;
    shipment_settings?: ParsedShipmentSettings;

    // Root-level mapped fields (from shipment_settings)
    shipmentEnabled?: boolean;
    useIntegrationCargoLabel?: boolean;
    customCargoIntegrationId?: string | null;
    customCargoName?: string | null;
    autoSendToCustomCargo?: boolean;
    shipmentSenderInfo?: any;
    fallbackCargoIntegrationId?: string | null;
    fallbackCargoName?: string | null;

    // Root-level mapped fields (from order_update_settings)
    syncOrderStatus?: boolean;
    syncCancelledOrders?: boolean;
    syncReturnedOrders?: boolean;

    // Meta fields
    integration_active?: boolean;
    user?: string;
    platform?: string;
}

export class CredentialsService {
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
    static mergeAndParse(
        baseCredentials: Map<string, string> | Record<string, any> | null,
        integrationCredentials: Map<string, string> | Record<string, any>,
        integrationId: string,
        integrationName: string,
        integrationType: IntegrationType
    ): ParsedCredentials {
        // 1. Map'leri Object'e çevir
        const baseObj = this.toObject(baseCredentials);
        const integrationObj = this.toObject(integrationCredentials);

        // 2. Merge (BASE + Integration, integration override priority)
        const merged: ParsedCredentials = {
            ...baseObj,
            ...integrationObj
        };

        logger.debug('CredentialsService.mergeAndParse - Merged credentials', {
            baseCount: Object.keys(baseObj).length,
            integrationCount: Object.keys(integrationObj).length,
            mergedCount: Object.keys(merged).length,
            integrationName,
            integrationType
        });

        // 3. Integration type'a göre parse
        const isUpdatedSettings = integrationType === IntegrationType.MarketPlace || integrationType === IntegrationType.Ecommerce;

        // MARKETPLACE/ECOMMERCE: Product update settings
        if (isUpdatedSettings && merged.productUpdate && typeof merged.productUpdate === 'string') {
            merged.productUpdate = this.safeJsonParse(merged.productUpdate);
        }

        // MARKETPLACE/ECOMMERCE: Price update settings
        if (isUpdatedSettings && merged.price_update_settings) {
            merged.price_update_settings = this.parsePriceUpdateSettings(
                merged.price_update_settings,
                integrationName
            );
        }

        // MARKETPLACE/ECOMMERCE: Stock update settings
        if (isUpdatedSettings && merged.stock_update_settings) {
            merged.stock_update_settings = this.parseStockUpdateSettings(
                merged.stock_update_settings,
                integrationName
            );
        }

        // MARKETPLACE/ECOMMERCE: Order update settings
        if (isUpdatedSettings && merged.order_update_settings) {
            const { settings, syncAdvanced } = this.parseOrderUpdateSettings(
                merged.order_update_settings,
                integrationName
            );
            merged.order_update_settings = settings;

            // syncAdvanced -> root level mapping
            if (syncAdvanced) {
                merged.syncOrderStatus = syncAdvanced.syncStatus;
                merged.syncCancelledOrders = syncAdvanced.syncCancelled;
                merged.syncReturnedOrders = syncAdvanced.syncReturned;

                logger.debug('CredentialsService - Mapped syncAdvanced to root level', {
                    syncOrderStatus: merged.syncOrderStatus,
                    syncCancelledOrders: merged.syncCancelledOrders,
                    syncReturnedOrders: merged.syncReturnedOrders
                });
            }
        }

        // ALL TYPES: Shipment settings (MARKETPLACE, ECOMMERCE ve CARGO için geçerli)
        if (merged.shipment_settings) {
            const { settings, rootFields } = this.parseShipmentSettings(
                merged.shipment_settings,
                integrationId,
                integrationName
            );
            merged.shipment_settings = settings;

            // Root level mapping
            Object.assign(merged, rootFields);

            logger.debug('CredentialsService - Shipment settings mapped to root level', {
                integrationName,
                integrationType,
                shipmentEnabled: rootFields.shipmentEnabled,
                useIntegrationCargoLabel: rootFields.useIntegrationCargoLabel,
                customCargoIntegrationId: rootFields.customCargoIntegrationId,
                autoSendToCustomCargo: rootFields.autoSendToCustomCargo
            });
        }

        return merged;
    }

    /**
     * Map veya Object'i Object'e çevirir
     */
    static toObject(data: Map<string, any> | Record<string, any> | null): Record<string, any> {
        if (!data) return {};
        if (data instanceof Map) {
            return Object.fromEntries(data);
        }
        return { ...data };
    }

    /**
     * Güvenli JSON parse
     */
    static safeJsonParse(value: string | any): any {
        if (typeof value !== 'string') return value;
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }

    /**
     * Price update settings parse ve filter
     */
    private static parsePriceUpdateSettings(
        raw: string | any,
        integrationName: string
    ): ParsedPriceUpdateSettings {
        const settings = this.safeJsonParse(raw);

        if (!settings || !settings.sources) {
            return { enable: false, sources: [] };
        }

        const matchingSource = settings.sources.find((s: any) => s.name === integrationName);

        return {
            ...settings,
            enable: matchingSource ? matchingSource.enable : false,
            sources: settings.sources.filter((s: any) => s.name === integrationName)
        };
    }

    /**
     * Stock update settings parse ve filter
     */
    private static parseStockUpdateSettings(
        raw: string | any,
        integrationName: string
    ): ParsedStockUpdateSettings {
        const settings = this.safeJsonParse(raw);

        if (!settings || !settings.sources) {
            return { enabled: false, sources: [] };
        }

        const matchingSource = settings.sources.find((s: any) => s.name === integrationName);

        return {
            ...settings,
            enable: matchingSource ? matchingSource.enable : false,
            sources: settings.sources.filter((s: any) => s.name === integrationName)
        };
    }

    /**
     * Order update settings parse ve filter
     */
    private static parseOrderUpdateSettings(
        raw: string | any,
        integrationName: string
    ): { settings: ParsedOrderUpdateSettings; syncAdvanced?: any } {
        const settings = this.safeJsonParse(raw);

        if (!settings || !settings.sources) {
            return { settings: { enable: false, sources: [] }, syncAdvanced: undefined };
        }

        const matchingSource = settings.sources.find((s: any) => s.name === integrationName);

        return {
            settings: {
                ...settings,
                enable: matchingSource ? matchingSource.enable : false,
                sources: settings.sources.filter((s: any) => s.name === integrationName)
            },
            syncAdvanced: matchingSource?.syncAdvanced
        };
    }

    /**
     * Shipment settings parse ve filter
     */
    private static parseShipmentSettings(
        raw: string | any,
        integrationId: string,
        integrationName: string
    ): { settings: ParsedShipmentSettings; rootFields: Record<string, any> } {
        const settings = this.safeJsonParse(raw);

        if (!settings) {
            return {
                settings: { enabled: false, useIntegrationCargoLabel: true, sources: [] },
                rootFields: {
                    shipmentEnabled: false,
                    useIntegrationCargoLabel: true,
                    customCargoIntegrationId: null,
                    customCargoName: null,
                    autoSendToCustomCargo: false,
                    shipmentSenderInfo: null,
                    fallbackCargoIntegrationId: null,
                    fallbackCargoName: null
                }
            };
        }

        const matchingSource = settings.sources?.find(
            (s: any) => s.integrationId === integrationId.toString() || s.name === integrationName
        );

        const rootFields = {
            shipmentEnabled: matchingSource?.enabled ?? false,
            useIntegrationCargoLabel: settings.useIntegrationCargoLabel ?? true,
            customCargoIntegrationId: matchingSource?.cargoIntegrationId || null,
            customCargoName: matchingSource?.cargoName || null,
            autoSendToCustomCargo: matchingSource?.autoSendOnOrderCreated ?? false,
            shipmentSenderInfo: settings.senderInfo || null,
            fallbackCargoIntegrationId: settings.fallbackCargoIntegrationId || null,
            fallbackCargoName: settings.fallbackCargoName || null
        };

        const parsedSettings: ParsedShipmentSettings = {
            ...settings,
            enabled: settings.enabled ?? false,
            useIntegrationCargoLabel: settings.useIntegrationCargoLabel ?? true,
            enabledForThisIntegration: matchingSource?.enabled ?? false,
            currentSource: matchingSource || null,
            sources: settings.sources?.filter(
                (s: any) => s.integrationId === integrationId.toString() || s.name === integrationName
            ) || []
        };

        return { settings: parsedSettings, rootFields };
    }
}
