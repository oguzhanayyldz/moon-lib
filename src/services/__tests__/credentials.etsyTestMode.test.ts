import { CredentialsService } from '../credentials.service';
import { IntegrationType } from '../../common';
import { isTestMode } from '../../utils/testMode.util';

/**
 * UC-2167 (B2): Etsy'de testMode TERS varsayılandır — yalnız ENTEGRASYON kaydında açıkça `false` / `'false'`
 * (büyük-küçük harf ve boşluk duyarsız) CANLI. Diğer her değer ve BASE kaydından miras TEST kalır.
 * Diğer entegrasyonların davranışı (isTestMode normalizasyonu) DEĞİŞMEZ.
 */
const merge = (name: string, integration: Record<string, any>, base: Record<string, any> | null = null) =>
    CredentialsService.mergeAndParse(base, integration, 'id', name, IntegrationType.MarketPlace);

describe('CredentialsService.mergeAndParse — Etsy testMode (UC-2167)', () => {
    it.each([
        // Zoe §3 tablosu — TEST kalması gerekenler
        ['anahtar yok', undefined, true],
        ['true', true, true], ["'true'", 'true', true], ["'TRUE'", 'TRUE', true], ['1', 1, true], ["'1'", '1', true],
        ["''", '', true], ["'0'", '0', true], ['0', 0, true], ['null', null, true],
        ["' true '", ' true ', true], ["'yes'", 'yes', true], ["'on'", 'on', true], ["'no'", 'no', true],
        ["'falsey'", 'falsey', true], ['{}', {}, true],
        // CANLI — yalnız açık false
        ['false', false, false], ["'false'", 'false', false], ["' false '", ' false ', false], ["'FALSE'", 'FALSE', false], ["'False'", 'False', false]
    ])('Etsy kaydı testMode=%s → testMode=%p', (_label, value, expected) => {
        const integration = value === undefined ? { apiKey: 'k' } : { testMode: value };
        expect(merge('Etsy', integration).testMode).toBe(expected);
    });

    it("BASE testMode='false' iken Etsy kaydında anahtar yok → TEST (BASE'ten canlı miras alınmaz)", () => {
        expect(merge('Etsy', {}, { testMode: 'false' }).testMode).toBe(true);
        expect(merge('Etsy', {}, { testMode: false }).testMode).toBe(true);
    });

    it("BASE testMode='true', Etsy kaydı 'false' → CANLI (kiracının açık kararı)", () => {
        expect(merge('Etsy', { testMode: 'false' }, { testMode: 'true' }).testMode).toBe(false);
    });

    it('ad büyük-küçük harf / boşluk duyarsız eşleşir', () => {
        expect(merge('etsy', { testMode: '' }).testMode).toBe(true);
        expect(merge(' ETSY ', {}, { testMode: 'false' }).testMode).toBe(true);
    });
});

describe('CredentialsService.mergeAndParse — diğer entegrasyonlarda testMode DEĞİŞMEDİ (UC-2167 kısıtı)', () => {
    const values: unknown[] = [true, 'true', 'TRUE', 1, '1', false, 'false', ' false ', 'FALSE', 0, '0', '', null, ' true ', 'yes', 'on', 2];
    const names = ['Hepsiburada', 'Trendyol', 'Amazon', 'N11', 'Shopify', 'Ebay', 'Etsyx'];

    it.each(names)('%s: kayıt değeri isTestMode ile normalize edilir (eski davranış)', (name) => {
        for (const value of values) {
            expect(merge(name, { testMode: value }).testMode).toBe(isTestMode(value));
        }
    });

    it.each(names)('%s: anahtar yoksa testMode eklenmez; BASE değeri miras alınır', (name) => {
        expect('testMode' in merge(name, { apiKey: 'k' })).toBe(false);
        expect(merge(name, {}, { testMode: 'false' }).testMode).toBe(false);
        expect(merge(name, {}, { testMode: 'true' }).testMode).toBe(true);
    });
});
