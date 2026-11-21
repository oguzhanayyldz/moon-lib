import { CurrencyCode } from '../currency-code';
import { CurrencySymbol } from '../currency-symbol';

/**
 * UC-1946 (K4) — CurrencyCode genişletmesi.
 * eBay/Etsy/Amazon yurtdışı siparişleri CAD/AUD gibi para birimleriyle gelir; enum'da yoksa
 * sipariş şeması reddeder ya da entegrasyon sessizce TRY etiketler. Eklenenler TCMB günlük
 * kur dosyasında yayınlanan kodlardır (UC-1948 kur yolu aynı kodla çalışır).
 */
describe('CurrencyCode (UC-1946)', () => {
    it('mevcut kodlar değişmeden kalır (geriye uyumluluk)', () => {
        expect(CurrencyCode.USD).toBe('USD');
        expect(CurrencyCode.EUR).toBe('EUR');
        expect(CurrencyCode.TRY).toBe('TRY');
        expect(CurrencyCode.GBP).toBe('GBP');
        expect(CurrencyCode.JPY).toBe('JPY');
    });

    it('CAD ve AUD enum içinde', () => {
        expect(CurrencyCode.CAD).toBe('CAD');
        expect(CurrencyCode.AUD).toBe('AUD');
    });

    it('pazaryeri + TCMB kesişimindeki diğer kodlar da var', () => {
        expect(Object.values(CurrencyCode)).toEqual(
            expect.arrayContaining(['CHF', 'SEK', 'NOK', 'DKK', 'SAR', 'AED', 'CNY'])
        );
    });

    it('her enum değeri ISO-4217 biçiminde (3 büyük harf) ve tekrarsız', () => {
        const values = Object.values(CurrencyCode);
        values.forEach(v => expect(v).toMatch(/^[A-Z]{3}$/));
        expect(new Set(values).size).toBe(values.length);
    });

    it('her para birimi için bir CurrencySymbol karşılığı var', () => {
        Object.values(CurrencyCode).forEach(code => {
            expect((CurrencySymbol as Record<string, string>)[code]).toEqual(expect.any(String));
        });
    });
});
