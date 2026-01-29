"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CredentialsService = void 0;
const logger_service_1 = require("./logger.service");
const integration_type_1 = require("../common/types/integration-type");
class CredentialsService {
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
    static mergeAndParse(baseCredentials, integrationCredentials, integrationId, integrationName, integrationType) {
        // 1. Map'leri Object'e çevir
        const baseObj = this.toObject(baseCredentials);
        const integrationObj = this.toObject(integrationCredentials);
        // 2. Merge (BASE + Integration, integration override priority)
        const merged = Object.assign(Object.assign({}, baseObj), integrationObj);
        logger_service_1.logger.debug('CredentialsService.mergeAndParse - Merged credentials', {
            baseCount: Object.keys(baseObj).length,
            integrationCount: Object.keys(integrationObj).length,
            mergedCount: Object.keys(merged).length,
            integrationName,
            integrationType
        });
        // 3. Integration type'a göre parse
        const isUpdatedSettings = integrationType === integration_type_1.IntegrationType.MarketPlace || integrationType === integration_type_1.IntegrationType.Ecommerce;
        // MARKETPLACE/ECOMMERCE: Product update settings
        if (isUpdatedSettings && merged.productUpdate && typeof merged.productUpdate === 'string') {
            merged.productUpdate = this.safeJsonParse(merged.productUpdate);
        }
        // MARKETPLACE/ECOMMERCE: Price update settings
        if (isUpdatedSettings && merged.price_update_settings) {
            merged.price_update_settings = this.parsePriceUpdateSettings(merged.price_update_settings, integrationName);
        }
        // MARKETPLACE/ECOMMERCE: Stock update settings
        if (isUpdatedSettings && merged.stock_update_settings) {
            merged.stock_update_settings = this.parseStockUpdateSettings(merged.stock_update_settings, integrationName);
        }
        // MARKETPLACE/ECOMMERCE: Order update settings
        if (isUpdatedSettings && merged.order_update_settings) {
            const { settings, syncAdvanced } = this.parseOrderUpdateSettings(merged.order_update_settings, integrationName);
            merged.order_update_settings = settings;
            // syncAdvanced -> root level mapping
            if (syncAdvanced) {
                merged.syncOrderStatus = syncAdvanced.syncStatus;
                merged.syncCancelledOrders = syncAdvanced.syncCancelled;
                merged.syncReturnedOrders = syncAdvanced.syncReturned;
                logger_service_1.logger.debug('CredentialsService - Mapped syncAdvanced to root level', {
                    syncOrderStatus: merged.syncOrderStatus,
                    syncCancelledOrders: merged.syncCancelledOrders,
                    syncReturnedOrders: merged.syncReturnedOrders
                });
            }
        }
        // ALL TYPES: Shipment settings (MARKETPLACE, ECOMMERCE ve CARGO için geçerli)
        if (merged.shipment_settings) {
            const { settings, rootFields } = this.parseShipmentSettings(merged.shipment_settings, integrationId, integrationName);
            merged.shipment_settings = settings;
            // Root level mapping
            Object.assign(merged, rootFields);
            logger_service_1.logger.debug('CredentialsService - Shipment settings mapped to root level', {
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
    static toObject(data) {
        if (!data)
            return {};
        if (data instanceof Map) {
            return Object.fromEntries(data);
        }
        return Object.assign({}, data);
    }
    /**
     * Güvenli JSON parse
     */
    static safeJsonParse(value) {
        if (typeof value !== 'string')
            return value;
        try {
            return JSON.parse(value);
        }
        catch (_a) {
            return value;
        }
    }
    /**
     * Price update settings parse ve filter
     */
    static parsePriceUpdateSettings(raw, integrationName) {
        const settings = this.safeJsonParse(raw);
        if (!settings || !settings.sources) {
            return { enable: false, sources: [] };
        }
        const matchingSource = settings.sources.find((s) => s.name === integrationName);
        return Object.assign(Object.assign({}, settings), { enable: matchingSource ? matchingSource.enable : false, sources: settings.sources.filter((s) => s.name === integrationName) });
    }
    /**
     * Stock update settings parse ve filter
     */
    static parseStockUpdateSettings(raw, integrationName) {
        const settings = this.safeJsonParse(raw);
        if (!settings || !settings.sources) {
            return { enabled: false, sources: [] };
        }
        const matchingSource = settings.sources.find((s) => s.name === integrationName);
        return Object.assign(Object.assign({}, settings), { enable: matchingSource ? matchingSource.enable : false, sources: settings.sources.filter((s) => s.name === integrationName) });
    }
    /**
     * Order update settings parse ve filter
     */
    static parseOrderUpdateSettings(raw, integrationName) {
        const settings = this.safeJsonParse(raw);
        if (!settings || !settings.sources) {
            return { settings: { enable: false, sources: [] }, syncAdvanced: undefined };
        }
        const matchingSource = settings.sources.find((s) => s.name === integrationName);
        return {
            settings: Object.assign(Object.assign({}, settings), { enable: matchingSource ? matchingSource.enable : false, sources: settings.sources.filter((s) => s.name === integrationName) }),
            syncAdvanced: matchingSource === null || matchingSource === void 0 ? void 0 : matchingSource.syncAdvanced
        };
    }
    /**
     * Shipment settings parse ve filter
     */
    static parseShipmentSettings(raw, integrationId, integrationName) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
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
        const matchingSource = (_a = settings.sources) === null || _a === void 0 ? void 0 : _a.find((s) => s.integrationId === integrationId.toString() || s.name === integrationName);
        const rootFields = {
            shipmentEnabled: (_b = matchingSource === null || matchingSource === void 0 ? void 0 : matchingSource.enabled) !== null && _b !== void 0 ? _b : false,
            useIntegrationCargoLabel: (_c = settings.useIntegrationCargoLabel) !== null && _c !== void 0 ? _c : true,
            customCargoIntegrationId: (matchingSource === null || matchingSource === void 0 ? void 0 : matchingSource.cargoIntegrationId) || null,
            customCargoName: (matchingSource === null || matchingSource === void 0 ? void 0 : matchingSource.cargoName) || null,
            autoSendToCustomCargo: (_d = matchingSource === null || matchingSource === void 0 ? void 0 : matchingSource.autoSendOnOrderCreated) !== null && _d !== void 0 ? _d : false,
            shipmentSenderInfo: settings.senderInfo || null,
            fallbackCargoIntegrationId: settings.fallbackCargoIntegrationId || null,
            fallbackCargoName: settings.fallbackCargoName || null
        };
        const parsedSettings = Object.assign(Object.assign({}, settings), { enabled: (_e = settings.enabled) !== null && _e !== void 0 ? _e : false, useIntegrationCargoLabel: (_f = settings.useIntegrationCargoLabel) !== null && _f !== void 0 ? _f : true, enabledForThisIntegration: (_g = matchingSource === null || matchingSource === void 0 ? void 0 : matchingSource.enabled) !== null && _g !== void 0 ? _g : false, currentSource: matchingSource || null, sources: ((_h = settings.sources) === null || _h === void 0 ? void 0 : _h.filter((s) => s.integrationId === integrationId.toString() || s.name === integrationName)) || [] });
        return { settings: parsedSettings, rootFields };
    }
}
exports.CredentialsService = CredentialsService;
