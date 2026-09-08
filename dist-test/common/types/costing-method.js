"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_COSTING_METHOD = exports.CostingMethod = void 0;
/**
 * Stok degerleme yontemi — siparis maliyeti hangi katmandan hesaplanir (issue #681, epic #677).
 *
 * Katman FIZIKSEL raf DEGIL, mantiksal kuyruktur: ayni urunun raflari maliyete gore
 * ayrilmaz. Muhasebede FIFO da boyle calisir — "hangi raftan cikti" degil, "hangi maliyet
 * katmanindan dusuldu" demektir.
 *
 * YONTEM DEGISIRSE GECMIS SIPARISLER YENIDEN HESAPLANMAZ: siparis maliyeti satis aninda
 * dondurulur (muhasebe dogrulugu — satilan malin maliyeti o gunku maliyettir). Ayar yalniz
 * bundan SONRAKI siparisleri etkiler.
 */
var CostingMethod;
(function (CostingMethod) {
    /** Ilk giren ilk cikar — en eski katman once tuketilir. VUK/TMS standardi, VARSAYILAN */
    CostingMethod["Fifo"] = "fifo";
    /**
     * Tukenmemis katmanlar icinde en dusuk birim maliyetli once tuketilir.
     * Standart bir degerleme yontemi DEGILDIR ve kari basta yuksek gosterir — ic raporlama
     * tercihi olarak sunulur, arayuzde bu uyariyla birlikte gosterilmelidir.
     */
    CostingMethod["Lowest"] = "lowest";
    /** Tukenmemis katmanlarin agirlikli ortalamasi; tuketim yine FIFO sirasiyla yapilir */
    CostingMethod["Average"] = "average";
})(CostingMethod || (exports.CostingMethod = CostingMethod = {}));
/** Ayar hic yazilmamisken / okunamadiginda kullanilan yontem */
exports.DEFAULT_COSTING_METHOD = CostingMethod.Fifo;
//# sourceMappingURL=costing-method.js.map