"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrencySymbol = void 0;
var CurrencySymbol;
(function (CurrencySymbol) {
    CurrencySymbol["USD"] = "$";
    CurrencySymbol["EUR"] = "\u20AC";
    CurrencySymbol["TRY"] = "\u20BA";
    CurrencySymbol["GBP"] = "\u00A3";
    CurrencySymbol["JPY"] = "\u00A5";
    // UC-1946: CurrencyCode ile birebir eşleşir
    CurrencySymbol["CAD"] = "CA$";
    CurrencySymbol["AUD"] = "A$";
    CurrencySymbol["CHF"] = "CHF";
    CurrencySymbol["SEK"] = "SEK";
    CurrencySymbol["NOK"] = "NOK";
    CurrencySymbol["DKK"] = "DKK";
    CurrencySymbol["SAR"] = "SAR";
    CurrencySymbol["AED"] = "AED";
    CurrencySymbol["CNY"] = "CN\u00A5";
    // ... diğer para birimi sembolleri
})(CurrencySymbol || (exports.CurrencySymbol = CurrencySymbol = {}));
//# sourceMappingURL=currency-symbol.js.map