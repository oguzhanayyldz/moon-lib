"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrencyCode = void 0;
var CurrencyCode;
(function (CurrencyCode) {
    CurrencyCode["USD"] = "USD";
    CurrencyCode["EUR"] = "EUR";
    CurrencyCode["TRY"] = "TRY";
    CurrencyCode["GBP"] = "GBP";
    CurrencyCode["JPY"] = "JPY";
    // UC-1946: eBay/Etsy/Amazon yurtdışı siparişleri için. Hepsi TCMB günlük kur dosyasında (Unit=1) yayınlanır.
    CurrencyCode["CAD"] = "CAD";
    CurrencyCode["AUD"] = "AUD";
    CurrencyCode["CHF"] = "CHF";
    CurrencyCode["SEK"] = "SEK";
    CurrencyCode["NOK"] = "NOK";
    CurrencyCode["DKK"] = "DKK";
    CurrencyCode["SAR"] = "SAR";
    CurrencyCode["AED"] = "AED";
    CurrencyCode["CNY"] = "CNY";
    // ... diğer para birimi kodları
})(CurrencyCode || (exports.CurrencyCode = CurrencyCode = {}));
