"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockActionType = void 0;
var StockActionType;
(function (StockActionType) {
    // Stok ekleme
    StockActionType["Addition"] = "addition";
    // Stok çıkarma
    StockActionType["Removal"] = "removal";
    // Stoklar arası transfer
    StockActionType["Transfer"] = "transfer";
    // Stok düzeltme
    StockActionType["Adjustment"] = "adjustment";
    // Sipariş rezervasyonu
    StockActionType["OrderReservation"] = "order_reservation";
    // Sipariş iptal
    StockActionType["OrderCancel"] = "order_cancel";
    // Sipariş tamamlama
    StockActionType["OrderComplete"] = "order_complete";
    // Stok sayımı
    StockActionType["Inventory"] = "inventory";
    // Ürün iade
    StockActionType["Return"] = "return";
    // Seri numarası kontrolü 
    StockActionType["SerialNumberCheck"] = "serial_number_check";
    // Diğer değişimler
    StockActionType["Other"] = "other";
})(StockActionType || (exports.StockActionType = StockActionType = {}));
//# sourceMappingURL=stock-action-type.js.map