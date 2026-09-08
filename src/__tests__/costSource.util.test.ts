import { canOverrideCost } from '../utils/costSource.util';
import { CostSource, costSourcePrecedence } from '../common/types/cost-source';

/**
 * Maliyet kaynagi ezme kurali testleri (issue #681)
 *
 * Bu kural uretimde bir kusurdan dogdu: alis faturasi, kullanicinin Excel'den girdigi
 * maliyeti haber vermeden eziyordu. Bu yuzden testler "Manual hicbir seyle ezilmez"
 * maddesini TUM kaynaklara karsi tek tek dogrular — tek bir ornekle gecilmez.
 */
describe('canOverrideCost', () => {
    const allSources = Object.values(CostSource);

    it('mevcut deger yoksa her kaynak yazabilir', () => {
        for (const incoming of allSources) {
            expect(canOverrideCost(undefined, incoming)).toBe(true);
            expect(canOverrideCost(null, incoming)).toBe(true);
        }
    });

    it('Manual hicbir otomatik kaynak tarafindan ezilemez', () => {
        for (const incoming of allSources) {
            if (incoming === CostSource.Manual) continue;
            expect(canOverrideCost(CostSource.Manual, incoming)).toBe(false);
        }
    });

    it('Manual kendini ezebilir — kullanici degeri yeniden girebilmeli', () => {
        expect(canOverrideCost(CostSource.Manual, CostSource.Manual)).toBe(true);
    });

    it('her kaynak kendini ezebilir — ayni kaynaktan gelen yeni veri gecerlidir', () => {
        for (const source of allSources) {
            expect(canOverrideCost(source, source)).toBe(true);
        }
    });

    it('Layer, Fixed ve Import degerlerini ezer (katman sabit maliyetten kesindir)', () => {
        expect(canOverrideCost(CostSource.Fixed, CostSource.Layer)).toBe(true);
        expect(canOverrideCost(CostSource.Import, CostSource.Layer)).toBe(true);
    });

    it('Fixed, Layer degerini EZEMEZ', () => {
        expect(canOverrideCost(CostSource.Layer, CostSource.Fixed)).toBe(false);
    });

    it('kargo tarafi: Carrier > Marketplace > Tariff', () => {
        expect(canOverrideCost(CostSource.Marketplace, CostSource.Carrier)).toBe(true);
        expect(canOverrideCost(CostSource.Tariff, CostSource.Marketplace)).toBe(true);
        expect(canOverrideCost(CostSource.Tariff, CostSource.Carrier)).toBe(true);
        // ters yon
        expect(canOverrideCost(CostSource.Carrier, CostSource.Marketplace)).toBe(false);
        expect(canOverrideCost(CostSource.Marketplace, CostSource.Tariff)).toBe(false);
    });

    it('Tariff ve Import esit kesinlikte — birbirini ezebilir', () => {
        expect(canOverrideCost(CostSource.Import, CostSource.Tariff)).toBe(true);
        expect(canOverrideCost(CostSource.Tariff, CostSource.Import)).toBe(true);
    });

    it('tum ikili kombinasyonlar precedence haritasiyla tutarli', () => {
        for (const current of allSources) {
            for (const incoming of allSources) {
                const beklenen = costSourcePrecedence[incoming] >= costSourcePrecedence[current];
                expect(canOverrideCost(current, incoming)).toBe(beklenen);
            }
        }
    });

    /**
     * Haritada karsiligi olmayan bir deger sessizce her yonu `false` yapiyordu; alan bir
     * daha hic guncellenemez hale gelirdi ve bu bir hata degil "yazma kaybi" olarak
     * gorunurdu — teshis edilmesi cok zor bir sessiz kusur.
     */
    it('taninmayan mevcut kaynak alani kilitlemez — gecerli kaynak yazabilir', () => {
        const bozuk = 'eski-kaynak' as CostSource;

        expect(canOverrideCost(bozuk, CostSource.Layer)).toBe(true);
        expect(canOverrideCost(bozuk, CostSource.Manual)).toBe(true);
    });

    it('taninmayan GELEN kaynak yazamaz — fail-closed', () => {
        const bozuk = 'eski-kaynak' as CostSource;

        expect(canOverrideCost(CostSource.Fixed, bozuk)).toBe(false);
        expect(canOverrideCost(CostSource.Manual, bozuk)).toBe(false);
    });

    it('her CostSource degerinin precedence karsiligi tanimli', () => {
        // Yeni bir kaynak eklenip haritaya yazilmazsa karsilastirma undefined uzerinden
        // yapilir ve sessizce yanlis sonuc doner
        for (const source of allSources) {
            expect(typeof costSourcePrecedence[source]).toBe('number');
        }
    });
});
