"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PriceType = exports.UpdateFrequency = exports.PriceUpdateStrategy = void 0;
// Fiyat güncelleme stratejileri
var PriceUpdateStrategy;
(function (PriceUpdateStrategy) {
    PriceUpdateStrategy["PRIORITY"] = "priority";
    PriceUpdateStrategy["LOWEST"] = "lowest";
    PriceUpdateStrategy["HIGHEST"] = "highest";
    PriceUpdateStrategy["AVERAGE"] = "average";
})(PriceUpdateStrategy || (exports.PriceUpdateStrategy = PriceUpdateStrategy = {}));
// Güncelleme sıklıkları
var UpdateFrequency;
(function (UpdateFrequency) {
    UpdateFrequency["HOURLY"] = "hourly";
    UpdateFrequency["DAILY"] = "daily";
    UpdateFrequency["WEEKLY"] = "weekly";
    UpdateFrequency["MANUAL"] = "manual";
})(UpdateFrequency || (exports.UpdateFrequency = UpdateFrequency = {}));
// Fiyat tipleri
var PriceType;
(function (PriceType) {
    PriceType["PRICE"] = "price";
    PriceType["LIST_PRICE"] = "listPrice";
})(PriceType || (exports.PriceType = PriceType = {}));
//# sourceMappingURL=product-price-integration-updated.interface.js.map