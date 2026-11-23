import { CredentialsService, isEtsyIntegration } from '../credentials.service';
import { IntegrationType } from '../../common';
import { ResourceName } from '../../common/types/resourceName';

/**
 * UC-2169 — Etsy testMode kuralını katalog adına kilitleyen SÖZLEŞME testi.
 *
 * Neden: UC-2167 kuralı (Etsy'de testMode TERS varsayılan) entegrasyon adına bağlı. Ad kayarsa kural sessizce
 * kapanır ve '' / null / eksik testMode değerleri CANLI (gerçek satış) olur. Bu dosya adı iki yönden kilitler:
 *   1. Kuralın adı ResourceName.Etsy ile AYNI kaynaktan gelir (enum değişirse kural onunla birlikte gider).
 *   2. ResourceName.Etsy değerinin kendisi sabitlenir: değişirse bu test KIRMIZI olur ve katalog kaydı
 *      (integration servisi: INTEGRATION_TEMPLATES / credentialEncryption / DB kaydı adı) birlikte gözden geçirilir.
 *      Moon tarafındaki eşleşme testi: integration/src/__tests__/etsyCatalogName.contract.uc2169.test.ts
 */
const merge = (name: any, integration: Record<string, any>, base: Record<string, any> | null = null) =>
    CredentialsService.mergeAndParse(base, integration, 'id', name, IntegrationType.MarketPlace);

describe('UC-2169 sözleşme — Etsy adı kilidi', () => {
    it("ResourceName.Etsy değeri 'Etsy' olarak SABİT (katalog kaydı adıyla birebir)", () => {
        // Bu değer değişirse: katalog/DB kaydı adı, INTEGRATION_TEMPLATES anahtarı ve bu kural BİRLİKTE güncellenmeli.
        expect(ResourceName.Etsy).toBe('Etsy');
    });

    it('kuralın adı ResourceName.Etsy ile aynı kaynaktan gelir (enum kayarsa kural onunla kayar, sessizce kapanmaz)', () => {
        const original = ResourceName.Etsy;
        try {
            (ResourceName as any).Etsy = 'EtsyRenamed';
            expect(isEtsyIntegration('EtsyRenamed')).toBe(true);
            expect(isEtsyIntegration('Etsy')).toBe(false);
            // Yeni adla kayıt, anahtarsız testMode'da hâlâ TEST kalır (kural kapanmadı)
            expect(merge('EtsyRenamed', { testMode: '' }).testMode).toBe(true);
            expect(merge('EtsyRenamed', {}).testMode).toBe(true);
        } finally {
            (ResourceName as any).Etsy = original;
        }
    });

    it("katalog adı ResourceName.Etsy ile mergeAndParse: '' / null / anahtarsız → TEST, yalnız açık false → CANLI", () => {
        const name = ResourceName.Etsy;
        expect(merge(name, { testMode: '' }).testMode).toBe(true);
        expect(merge(name, { testMode: null }).testMode).toBe(true);
        expect(merge(name, {}).testMode).toBe(true);
        expect(merge(name, { testMode: 'false' }).testMode).toBe(false);
    });
});

describe('UC-2169 — ad varyantları (Zoe D2) için beklenen davranış belgelendi', () => {
    it.each([
        ['Etsy', true],
        ['etsy', true],
        ['ETSY', true],
        [' Etsy ', true],
        ['\tetsy\n', true]
    ])("ad %j → Etsy kuralı UYGULANIR (%s)", (name, expected) => {
        expect(isEtsyIntegration(name)).toBe(expected);
    });

    it.each([
        ['Etsy Shop', 'ek sözcük → eşleşmez'],
        ['Etsyx', 'ek karakter → eşleşmez'],
        ['Ets y', 'iç boşluk → eşleşmez'],
        ['Еtsy', "Kiril 'Е' (U+0415) → eşleşmez"],
        ['еtsy', "Kiril 'е' (U+0435) → eşleşmez"],
        ['Etѕy', "Kiril 'ѕ' (U+0455) → eşleşmez"],
        ['', 'boş dize → eşleşmez'],
        ['   ', 'yalnız boşluk → eşleşmez']
    ])('ad %j → kural UYGULANMAZ (%s)', (name) => {
        expect(isEtsyIntegration(name)).toBe(false);
    });

    it.each([[undefined], [null], [123], [{}], [['etsy']]])('ad %p (string değil) → kural UYGULANMAZ, patlamaz', (name) => {
        expect(isEtsyIntegration(name as any)).toBe(false);
    });

    it("eşleşmeyen adlarda Etsy kuralı işlemez: eski isTestMode davranışı (anahtarsız → testMode eklenmez, '' → canlı)", () => {
        // BİLİNEN RİSK (davranış değişikliği DEĞİL): ad kayıp eşleşmezse bu kayıtlar eski normalizasyonla CANLI sayılır.
        // Asıl koruma 'ad kayması' testleridir (yukarıda + moon tarafı katalog testi).
        expect('testMode' in merge('Etsy Shop', { apiKey: 'k' })).toBe(false);
        expect(merge('Etsy Shop', { testMode: '' }).testMode).toBe(false);
        expect(merge('Еtsy', { testMode: '' }).testMode).toBe(false);
        expect(merge(undefined, { testMode: '' }).testMode).toBe(false);
    });
});
