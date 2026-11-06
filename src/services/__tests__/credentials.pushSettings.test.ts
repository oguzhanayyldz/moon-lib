import { CredentialsService } from '../credentials.service';
import { IntegrationType } from '../../common';
import { STOCK_PUSH_DISABLED_SKIP_REASON, PRICE_PUSH_DISABLED_SKIP_REASON } from '../../common/constants/command-item-summary';

const push = (sources: any[]) => JSON.stringify({ sources, updatedAt: '2026-11-06T00:00:00.000Z' });
const merge = (base: any, id = 'int-a', name = 'trendyol', type = IntegrationType.MarketPlace) =>
    CredentialsService.mergeAndParse(base, {}, id, name, type);

describe('CredentialsService — stok/fiyat gönderim ayarı (UC-1467)', () => {
    it('anahtar yok → ikisi de true (base null dahil)', () => {
        for (const base of [null, {}, { other: 'x' }]) {
            const r = merge(base);
            expect(r.stockPushEnabled).toBe(true);
            expect(r.pricePushEnabled).toBe(true);
        }
    });

    it('bozuk JSON / sources dizi değil → true', () => {
        const r = merge({ stock_push_settings: '{bozuk', price_push_settings: JSON.stringify({ sources: 'x' }) });
        expect(r.stockPushEnabled).toBe(true);
        expect(r.pricePushEnabled).toBe(true);
    });

    it('integrationId eşleşmesi enabled:false → yalnız o alan false', () => {
        const r = merge({ stock_push_settings: push([{ integrationId: 'int-a', integrationName: 'trendyol', enabled: false }]) });
        expect(r.stockPushEnabled).toBe(false);
        expect(r.pricePushEnabled).toBe(true);
    });

    it('yalnız name eşleşmesi (id yok) enabled:false → false; Ecommerce dalı da doldurur', () => {
        const r = merge({ price_push_settings: push([{ name: 'shopify', enabled: false }]) }, 'x', 'shopify', IntegrationType.Ecommerce);
        expect(r.pricePushEnabled).toBe(false);
        expect(r.stockPushEnabled).toBe(true);
    });

    it('başka entegrasyon kapalı → true; aynı platformun ikinci mağazası etkilenmez', () => {
        const base = { stock_push_settings: push([{ integrationId: 'int-b', integrationName: 'trendyol', enabled: false }]) };
        expect(merge(base, 'int-a').stockPushEnabled).toBe(true);
        expect(merge(base, 'int-b').stockPushEnabled).toBe(false);
    });

    it('enabled:true kaynak → true', () => {
        expect(merge({ stock_push_settings: push([{ integrationId: 'int-a', enabled: true }]) }).stockPushEnabled).toBe(true);
    });

    it('Map base de çalışır', () => {
        const m = new Map([['stock_push_settings', push([{ integrationId: 'int-a', enabled: false }])]]);
        expect(merge(m).stockPushEnabled).toBe(false);
    });

    it('cargo tipinde alanlar eklenmez', () => {
        const r = merge({}, 'c', 'yurtici', IntegrationType.Cargo);
        expect(r.stockPushEnabled).toBeUndefined();
    });

    it('isStockPushEnabled / isPricePushEnabled: alan yoksa true, yalnız false → false', () => {
        expect(CredentialsService.isStockPushEnabled({})).toBe(true);
        expect(CredentialsService.isStockPushEnabled(null)).toBe(true);
        expect(CredentialsService.isStockPushEnabled({ stockPushEnabled: false })).toBe(false);
        expect(CredentialsService.isPricePushEnabled({})).toBe(true);
        expect(CredentialsService.isPricePushEnabled({ pricePushEnabled: false })).toBe(false);
    });

    it("resolvePushSettings: ham BASE'ten karar", () => {
        const base = { price_push_settings: push([{ integrationId: 'int-a', enabled: false }]) };
        expect(CredentialsService.resolvePushSettings(base, 'int-a', 'trendyol')).toEqual({ stockPushEnabled: true, pricePushEnabled: false });
        expect(CredentialsService.resolvePushSettings(null, undefined, 'trendyol')).toEqual({ stockPushEnabled: true, pricePushEnabled: true });
    });

    it('atlama nedeni sabitleri', () => {
        expect(STOCK_PUSH_DISABLED_SKIP_REASON).toBe('stock-push-disabled');
        expect(PRICE_PUSH_DISABLED_SKIP_REASON).toBe('price-push-disabled');
    });
});
