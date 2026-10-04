import { CredentialsService } from '../credentials.service';
import { IntegrationType } from '../../common';

describe('CredentialsService.mergeAndParse — source eşleme: integrationId öncelikli (B-21)', () => {
    const settings = {
        price_update_settings: JSON.stringify({
            enabled: true,
            sources: [
                { integrationId: 'store-a', integrationName: 'Shopify', enabled: true },
                { integrationId: 'store-b', integrationName: 'Shopify', enabled: false }
            ]
        })
    };

    it('aynı platformun ikinci mağazası birincinin kaynağını almaz', () => {
        const b = CredentialsService.mergeAndParse(settings, {}, 'store-b', 'Shopify', IntegrationType.Ecommerce);
        expect(b.price_update_settings!.sources).toHaveLength(1);
        expect(b.price_update_settings!.sources[0].integrationId).toBe('store-b');
        expect(b.price_update_settings!.enabled).toBe(false);

        const a = CredentialsService.mergeAndParse(settings, {}, 'store-a', 'Shopify', IntegrationType.Ecommerce);
        expect(a.price_update_settings!.sources[0].integrationId).toBe('store-a');
        expect(a.price_update_settings!.enabled).toBe(true);
    });

    it('integrationId taşımayan eski kaynaklar ada göre eşlenmeye devam eder', () => {
        const legacy = { price_update_settings: JSON.stringify({ sources: [{ integrationName: 'Shopify', enabled: true }] }) };
        const r = CredentialsService.mergeAndParse(legacy, {}, 'any-id', 'Shopify', IntegrationType.Ecommerce);
        expect(r.price_update_settings!.enabled).toBe(true);
    });
});
