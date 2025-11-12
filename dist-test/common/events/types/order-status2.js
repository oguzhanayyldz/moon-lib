"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderStatus2 = void 0;
/**
 * OrderStatus2 - Sipariş İade ve İptal Durumu Enum
 *
 * Bu enum, siparişlerin iade ve iptal durumlarını detaylı olarak takip eder.
 * Ana OrderStatus field'ından bağımsız olarak çalışır ve özellikle:
 * - Parçalı iptal/iade durumlarını
 * - İade süreç aşamalarını (talep, onay, devam, teslim, iade)
 * - Kombinasyon durumlarını (hem iptal hem iade)
 * takip etmek için kullanılır.
 *
 * @enum {string}
 */
var OrderStatus2;
(function (OrderStatus2) {
    /**
     * Normal - Herhangi bir iade veya iptal durumu yok
     */
    OrderStatus2["Normal"] = "normal";
    /**
     * PartialCancelled - Siparişin bir kısmı iptal edildi
     * Örnek: 3 ürünlü siparişte 1 ürün iptal edildi
     */
    OrderStatus2["PartialCancelled"] = "partial_cancelled";
    /**
     * FullyCancelled - Siparişin tamamı iptal edildi
     */
    OrderStatus2["FullyCancelled"] = "fully_cancelled";
    /**
     * ReturnRequested - Tüm sipariş için iade talebi oluşturuldu
     */
    OrderStatus2["ReturnRequested"] = "return_requested";
    /**
     * PartialReturnRequested - Siparişin bir kısmı için iade talebi oluşturuldu
     */
    OrderStatus2["PartialReturnRequested"] = "partial_return_requested";
    /**
     * ReturnApproved - Tüm sipariş için iade onaylandı
     */
    OrderStatus2["ReturnApproved"] = "return_approved";
    /**
     * PartialReturnApproved - Siparişin bir kısmı için iade onaylandı
     */
    OrderStatus2["PartialReturnApproved"] = "partial_return_approved";
    /**
     * ReturnInProgress - Tüm sipariş için iade işlemi devam ediyor
     */
    OrderStatus2["ReturnInProgress"] = "return_in_progress";
    /**
     * PartialReturnInProgress - Siparişin bir kısmı için iade işlemi devam ediyor
     */
    OrderStatus2["PartialReturnInProgress"] = "partial_return_in_progress";
    /**
     * ReturnReceived - Tüm sipariş için iade ürünleri teslim alındı
     */
    OrderStatus2["ReturnReceived"] = "return_received";
    /**
     * PartialReturnReceived - Siparişin bir kısmı için iade ürünleri teslim alındı
     */
    OrderStatus2["PartialReturnReceived"] = "partial_return_received";
    /**
     * ReturnRefunded - Tüm sipariş için para iadesi yapıldı
     */
    OrderStatus2["ReturnRefunded"] = "return_refunded";
    /**
     * PartialReturnRefunded - Siparişin bir kısmı için para iadesi yapıldı
     */
    OrderStatus2["PartialReturnRefunded"] = "partial_return_refunded";
    /**
     * ReturnRejected - İade talebi reddedildi
     */
    OrderStatus2["ReturnRejected"] = "return_rejected";
    /**
     * ReturnCancelled - İade talebi iptal edildi
     */
    OrderStatus2["ReturnCancelled"] = "return_cancelled";
    /**
     * CancelledAndReturned - Siparişte hem iptal hem iade durumu var
     * Örnek: 3 ürünlü siparişte 1 ürün iptal, 1 ürün iade edildi
     */
    OrderStatus2["CancelledAndReturned"] = "cancelled_and_returned";
})(OrderStatus2 || (exports.OrderStatus2 = OrderStatus2 = {}));
//# sourceMappingURL=order-status2.js.map