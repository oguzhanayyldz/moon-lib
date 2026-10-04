import { CredentialsService } from '../credentials.service';
import { IntegrationType } from '../../common';
import { EncryptionUtil } from '../../utils/encryption.util';
import { logger } from '../logger.service';

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

describe('CredentialsService.mergeAndParse — kablolama: stok/sipariş/kargo/fatura da integrationId geçirir (N-2, N-5)', () => {
    const sources = [
        { integrationId: 'store-a', integrationName: 'Shopify', name: 'Shopify', enabled: true },
        { integrationId: 'store-b', integrationName: 'Shopify', name: 'Shopify', enabled: false }
    ];
    const merge = (key: string, id: string, type = IntegrationType.Ecommerce) =>
        CredentialsService.mergeAndParse({ [key]: JSON.stringify({ enabled: true, sources }) }, {}, id, 'Shopify', type) as any;

    it.each(['stock_update_settings', 'order_update_settings', 'shipment_settings', 'invoice_settings'])(
        '%s: id verilen mağazada yalnız kendi kaynağı eşlenir',
        (key) => {
            const b = merge(key, 'store-b')[key];
            expect(b.sources).toHaveLength(1);
            expect(b.sources[0].integrationId).toBe('store-b');
            const a = merge(key, 'store-a')[key];
            expect(a.sources).toHaveLength(1);
            expect(a.sources[0].integrationId).toBe('store-a');
        }
    );

    it('stok ve sipariş enabled bayrağı eşleşen kaynaktan gelir', () => {
        expect(merge('stock_update_settings', 'store-b').stock_update_settings.enabled).toBe(false);
        expect(merge('order_update_settings', 'store-b').order_update_settings.enabled).toBe(false);
        expect(merge('stock_update_settings', 'store-a').stock_update_settings.enabled).toBe(true);
    });

    it('kargo/fatura: id varsa ada düşmez; id taşımayan eski kayıt ada göre eşlenir', () => {
        expect(merge('shipment_settings', 'store-b').shipment_settings.enabledForThisIntegration).toBe(false);
        expect(merge('invoice_settings', 'store-b').invoice_settings.enabledForThisIntegration).toBe(false);
        const legacy = { shipment_settings: JSON.stringify({ sources: [{ name: 'Shopify', enabled: true }] }) };
        const r = CredentialsService.mergeAndParse(legacy, {}, 'x', 'Shopify', IntegrationType.Ecommerce) as any;
        expect(r.shipment_settings.enabledForThisIntegration).toBe(true);
    });
});

describe('CredentialsService.mergeAndParse — decrypt hatası logu (B-21)', () => {
    const KEY = 'a'.repeat(64);
    let prevKey: string | undefined;
    beforeEach(() => { prevKey = process.env.ENCRYPTION_KEY; process.env.ENCRYPTION_KEY = KEY; });
    afterEach(() => {
        if (prevKey === undefined) delete process.env.ENCRYPTION_KEY; else process.env.ENCRYPTION_KEY = prevKey;
        jest.restoreAllMocks();
    });

    it('bozuk şifreli değer korunur; warn yalnız key + err.message taşır, değeri taşımaz', () => {
        const good = EncryptionUtil.encrypt('gizli-deger', KEY);
        const [iv, tag, ct] = good.split(':');
        const tampered = [iv, tag, ct.replace(/^./, c => (c === '0' ? '1' : '0'))].join(':');
        const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined as any);

        const r = CredentialsService.mergeAndParse({}, { apiSecret: tampered }, 'id', 'Shopify', IntegrationType.Ecommerce) as any;

        expect(r.apiSecret).toBe(tampered);
        const calls = (warn.mock.calls as any[][]).filter(c => String(c[0]).includes('decrypt'));
        expect(calls).toHaveLength(1);
        const meta = calls[0][1] as any;
        expect(Object.keys(meta).sort()).toEqual(['error', 'key']);
        expect(meta.key).toBe('apiSecret');
        expect(typeof meta.error).toBe('string');
        const dump = JSON.stringify(calls[0]);
        expect(dump).not.toContain(tampered);
        expect(dump).not.toContain(ct);
    });
});
