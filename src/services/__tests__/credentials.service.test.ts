import { CredentialsService } from '../credentials.service';
import { IntegrationType } from '../../common';

describe('CredentialsService.mergeAndParse — source-level enabled override', () => {
    const baseSettings = {
        stock_update_settings: JSON.stringify({
            enabled: true, // master AÇIK
            sources: [
                { integrationName: 'WooCommerce', name: 'WooCommerce', enabled: false, warehouseId: 'wh-1' },
                { integrationName: 'TSoft', name: 'TSoft', enabled: true, warehouseId: 'wh-2' }
            ]
        })
    };

    it('stock_update_settings.enabled = WC source.enabled (false) when master is true', () => {
        const result = CredentialsService.mergeAndParse(
            baseSettings,
            {},
            'wc-int-id',
            'WooCommerce',
            IntegrationType.Ecommerce
        );

        expect(result.stock_update_settings).toBeDefined();
        // Master true ama WC source false → enabled false (source override)
        expect(result.stock_update_settings!.enabled).toBe(false);
        // Sources sadece WC için filter edildi
        expect(result.stock_update_settings!.sources).toHaveLength(1);
        expect(result.stock_update_settings!.sources[0].integrationName).toBe('WooCommerce');
    });

    it('stock_update_settings.enabled = TSoft source.enabled (true) when master is true', () => {
        const result = CredentialsService.mergeAndParse(
            baseSettings,
            {},
            'tsoft-int-id',
            'TSoft',
            IntegrationType.Ecommerce
        );

        expect(result.stock_update_settings!.enabled).toBe(true);
        expect(result.stock_update_settings!.sources).toHaveLength(1);
        expect(result.stock_update_settings!.sources[0].integrationName).toBe('TSoft');
    });

    it('stock_update_settings.enabled = false when integration source not present', () => {
        const result = CredentialsService.mergeAndParse(
            baseSettings,
            {},
            'amazon-int-id',
            'Amazon',
            IntegrationType.MarketPlace
        );

        expect(result.stock_update_settings!.enabled).toBe(false);
        expect(result.stock_update_settings!.sources).toHaveLength(0);
    });

    it('returns enabled:false when sources is empty', () => {
        const result = CredentialsService.mergeAndParse(
            { stock_update_settings: JSON.stringify({ enabled: true, sources: [] }) },
            {},
            'wc-int-id',
            'WooCommerce',
            IntegrationType.Ecommerce
        );

        expect(result.stock_update_settings!.enabled).toBe(false);
    });

    it('legacy "name" field match works when integrationName missing', () => {
        const legacyBase = {
            stock_update_settings: JSON.stringify({
                enabled: true,
                sources: [{ name: 'WooCommerce', enabled: true, warehouseId: 'wh-1' }] // sadece name field
            })
        };
        const result = CredentialsService.mergeAndParse(
            legacyBase,
            {},
            'wc-int-id',
            'WooCommerce',
            IntegrationType.Ecommerce
        );

        expect(result.stock_update_settings!.enabled).toBe(true);
    });
});

describe('CredentialsService.mergeAndParse — price_update_settings source override', () => {
    const baseSettings = {
        price_update_settings: JSON.stringify({
            enabled: true,
            sources: [
                { integrationName: 'WooCommerce', name: 'WooCommerce', enabled: false },
                { integrationName: 'TSoft', name: 'TSoft', enabled: true }
            ]
        })
    };

    it('price_update_settings.enabled = WC source.enabled (false) when master is true', () => {
        const result = CredentialsService.mergeAndParse(
            baseSettings,
            {},
            'wc-int-id',
            'WooCommerce',
            IntegrationType.Ecommerce
        );

        expect(result.price_update_settings!.enabled).toBe(false);
        expect(result.price_update_settings!.sources).toHaveLength(1);
    });

    it('price_update_settings.enabled = TSoft source.enabled (true)', () => {
        const result = CredentialsService.mergeAndParse(
            baseSettings,
            {},
            'tsoft-int-id',
            'TSoft',
            IntegrationType.Ecommerce
        );

        expect(result.price_update_settings!.enabled).toBe(true);
    });
});

describe('CredentialsService.mergeAndParse — order_update_settings source override', () => {
    it('order_update_settings.enabled = source.enabled, syncAdvanced extracted', () => {
        const base = {
            order_update_settings: JSON.stringify({
                enabled: true,
                sources: [
                    {
                        integrationName: 'WooCommerce',
                        name: 'WooCommerce',
                        enabled: true,
                        syncAdvanced: { syncStatus: true, syncCancelled: false, syncReturned: true }
                    }
                ]
            })
        };
        const result = CredentialsService.mergeAndParse(
            base,
            {},
            'wc-int-id',
            'WooCommerce',
            IntegrationType.Ecommerce
        );

        expect(result.order_update_settings!.enabled).toBe(true);
        expect(result.syncOrderStatus).toBe(true);
        expect(result.syncCancelledOrders).toBe(false);
        expect(result.syncReturnedOrders).toBe(true);
    });
});
