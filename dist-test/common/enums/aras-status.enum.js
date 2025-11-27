"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArasQueryType = exports.ArasPaymentType = exports.ArasFailureReason = exports.ArasShipmentType = exports.ArasDeliveryStatus = void 0;
/**
 * Aras Kargo Durum Kodları
 * Kaynak: Aras API Dökümanı - Bölüm 3
 */
var ArasDeliveryStatus;
(function (ArasDeliveryStatus) {
    ArasDeliveryStatus[ArasDeliveryStatus["AT_ORIGIN"] = 1] = "AT_ORIGIN";
    ArasDeliveryStatus[ArasDeliveryStatus["IN_TRANSIT"] = 2] = "IN_TRANSIT";
    ArasDeliveryStatus[ArasDeliveryStatus["AT_DESTINATION"] = 3] = "AT_DESTINATION";
    ArasDeliveryStatus[ArasDeliveryStatus["OUT_FOR_DELIVERY"] = 4] = "OUT_FOR_DELIVERY";
    ArasDeliveryStatus[ArasDeliveryStatus["PARTIAL_DELIVERY"] = 5] = "PARTIAL_DELIVERY";
    ArasDeliveryStatus[ArasDeliveryStatus["DELIVERED"] = 6] = "DELIVERED";
    ArasDeliveryStatus[ArasDeliveryStatus["REDIRECTED"] = 7] = "REDIRECTED"; // Yönlendirildi
})(ArasDeliveryStatus || (exports.ArasDeliveryStatus = ArasDeliveryStatus = {}));
/**
 * Aras Tip Kodları
 */
var ArasShipmentType;
(function (ArasShipmentType) {
    ArasShipmentType[ArasShipmentType["NORMAL"] = 1] = "NORMAL";
    ArasShipmentType[ArasShipmentType["REDIRECTED"] = 2] = "REDIRECTED";
    ArasShipmentType[ArasShipmentType["RETURNED"] = 3] = "RETURNED"; // İade Edildi
})(ArasShipmentType || (exports.ArasShipmentType = ArasShipmentType = {}));
/**
 * Aras Devir (Teslim Edilememe) Neden Kodları
 */
var ArasFailureReason;
(function (ArasFailureReason) {
    ArasFailureReason["WRONG_ADDRESS"] = "AY";
    ArasFailureReason["NOTE_LEFT"] = "NT";
    ArasFailureReason["MOBILE_DELIVERY"] = "MD";
    ArasFailureReason["PICKUP_AT_BRANCH"] = "SA";
    ArasFailureReason["RECIPIENT_UNKNOWN"] = "AA";
    ArasFailureReason["PAYMENT_REFUSED"] = "\u00DCR";
    ArasFailureReason["CARGO_REFUSED"] = "KE"; // Kabul Etmiyor
})(ArasFailureReason || (exports.ArasFailureReason = ArasFailureReason = {}));
/**
 * Aras Ödeme Tipleri
 */
var ArasPaymentType;
(function (ArasPaymentType) {
    ArasPaymentType["SENDER_PAYS"] = "\u00DCG";
    ArasPaymentType["RECEIVER_PAYS"] = "\u00DCA"; // Ücreti Alıcıdan
})(ArasPaymentType || (exports.ArasPaymentType = ArasPaymentType = {}));
/**
 * Aras QueryType Kodları (SOAP sorgu tipleri)
 */
var ArasQueryType;
(function (ArasQueryType) {
    ArasQueryType[ArasQueryType["BY_INTEGRATION_CODE"] = 1] = "BY_INTEGRATION_CODE";
    ArasQueryType[ArasQueryType["DATE_RANGE"] = 12] = "DATE_RANGE";
    ArasQueryType[ArasQueryType["DATE_RANGE_DETAILED"] = 13] = "DATE_RANGE_DETAILED";
    ArasQueryType[ArasQueryType["BY_TRACKING_NUMBER"] = 14] = "BY_TRACKING_NUMBER";
    ArasQueryType[ArasQueryType["MOVEMENT_HISTORY"] = 15] = "MOVEMENT_HISTORY";
    ArasQueryType[ArasQueryType["BY_BARCODE"] = 24] = "BY_BARCODE";
    ArasQueryType[ArasQueryType["INCOMING_SHIPMENTS"] = 30] = "INCOMING_SHIPMENTS"; // Gelen kargolar (Return)
})(ArasQueryType || (exports.ArasQueryType = ArasQueryType = {}));
//# sourceMappingURL=aras-status.enum.js.map