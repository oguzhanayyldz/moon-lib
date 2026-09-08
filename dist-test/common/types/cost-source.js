"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.costSourcePrecedence = exports.CostSource = void 0;
/**
 * Bir maliyet degerinin NEREDEN geldigini soyler (issue #681, epic #677).
 *
 * NEDEN GEREKLI: Ayni maliyet alanina birden fazla kaynak yaziyor — mal kabul katmani,
 * Excel'den girilen sabit maliyet, kullanicinin elle yazdigi deger. Kaynak kaydedilmezse
 * hangisinin daha guvenilir oldugu bilinemez ve sonra gelen her yazim oncekini sessizce
 * ezer. Bu kusur uretimde goruldu: alis faturasi, kullanicinin Excel'den girdigi maliyeti
 * haber vermeden eziyordu (bkz. docs/architecture/maliyet-kurgusu.md).
 *
 * KESINLIK SIRASI icin `costSourcePrecedence` kullanilir; `Manual` en yuksek degeri tasir
 * ve hicbir otomatik kaynak tarafindan ezilmez — kullanici bilerek yazmistir.
 */
var CostSource;
(function (CostSource) {
    /** Maliyet katmanindan tuketildi (mal kabul / fiyatli stok girisi) */
    CostSource["Layer"] = "layer";
    /** Sabit maliyet: Price.costPrice (Excel, altyapi buyPrice, urun formu) */
    CostSource["Fixed"] = "fixed";
    /** Kullanici elle yazdi — hicbir otomatik kaynak ezemez */
    CostSource["Manual"] = "manual";
    /** Excel ile ice aktarildi */
    CostSource["Import"] = "import";
    /** Kargo firmasi API'sinden fiili ucret (kargo maliyeti) */
    CostSource["Carrier"] = "carrier";
    /** Pazaryeri hakedis/finans API'si (kargo ve komisyon) */
    CostSource["Marketplace"] = "marketplace";
    /** Kendi kademeli tarifemizden hesaplandi (kargo maliyeti) — TAHMIN */
    CostSource["Tariff"] = "tariff";
})(CostSource || (exports.CostSource = CostSource = {}));
/**
 * Kesinlik sirasi — buyuk sayi daha kesin kaynagi gosterir.
 *
 * `Manual` bilerek en yuksek degeri aldi: boylece `canOverride` icinde ayrica ozel durum
 * yazmaya gerek kalmadan hicbir otomatik kaynak onu gecemez.
 *
 * Kargo tarafinda `Carrier` (kargo firmasinin kestigi fatura) `Marketplace`ten (pazaryeri
 * hakedis kesintisi) daha kesindir; ikisi de `Tariff` tahminini ezer.
 */
exports.costSourcePrecedence = {
    [CostSource.Manual]: 100,
    [CostSource.Carrier]: 50,
    [CostSource.Layer]: 40,
    [CostSource.Marketplace]: 30,
    [CostSource.Fixed]: 20,
    [CostSource.Tariff]: 10,
    [CostSource.Import]: 10
};
//# sourceMappingURL=cost-source.js.map