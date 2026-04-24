"use strict";
/**
 * HepsiJet Kargo Durum Kodları
 * Kaynak: HepsiJet Developer Docs (https://developers.hepsiburada.com/hepsiburada/reference/post_rest-deliverytransaction-getdeliverytracking)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HepsiJetFailureReason = exports.HepsiJetLabelFormat = exports.HepsiJetServiceType = exports.HepsiJetDeliveryStatus = void 0;
exports.mapHepsiJetStatusToDeliveryStatus = mapHepsiJetStatusToDeliveryStatus;
/**
 * HepsiJet Teslimat Durumları (delivery status)
 * `getDeliveryTracking` response'undaki `status` alanında doner
 */
var HepsiJetDeliveryStatus;
(function (HepsiJetDeliveryStatus) {
    HepsiJetDeliveryStatus["CREATED"] = "CREATED";
    HepsiJetDeliveryStatus["COLLECTED"] = "COLLECTED";
    HepsiJetDeliveryStatus["IN_TRANSFER_HUB"] = "IN_TRANSFER_HUB";
    HepsiJetDeliveryStatus["OUT_FOR_DELIVERY"] = "OUT_FOR_DELIVERY";
    HepsiJetDeliveryStatus["DELIVERING"] = "DELIVERING";
    HepsiJetDeliveryStatus["DELIVERED"] = "DELIVERED";
    HepsiJetDeliveryStatus["NOT_DELIVERED"] = "NOT_DELIVERED";
    HepsiJetDeliveryStatus["RETURNED_TO_HUB"] = "RETURNED_TO_HUB";
    HepsiJetDeliveryStatus["RETURNED_TO_SENDER"] = "RETURNED_TO_SENDER";
    HepsiJetDeliveryStatus["CANCELLED"] = "CANCELLED";
    HepsiJetDeliveryStatus["UNKNOWN"] = "UNKNOWN"; // Bilinmiyor
})(HepsiJetDeliveryStatus || (exports.HepsiJetDeliveryStatus = HepsiJetDeliveryStatus = {}));
/**
 * HepsiJet Service Type Kodları
 * `sendDeliveryOrder` / `sendDeliveryOrderEnhanced` endpoint'lerinde kullanilir
 */
var HepsiJetServiceType;
(function (HepsiJetServiceType) {
    HepsiJetServiceType["STANDARD"] = "STANDARD";
    HepsiJetServiceType["TMH"] = "TMH";
    HepsiJetServiceType["POD"] = "POD";
    HepsiJetServiceType["APPOINTMENT"] = "APPOINTMENT"; // Randevulu teslimat
})(HepsiJetServiceType || (exports.HepsiJetServiceType = HepsiJetServiceType = {}));
/**
 * HepsiJet Label Format Kodları
 * `printLabel` islemlerinde kullanilan cikti formati
 */
var HepsiJetLabelFormat;
(function (HepsiJetLabelFormat) {
    HepsiJetLabelFormat["ZPL"] = "ZPL";
    HepsiJetLabelFormat["PDF"] = "PDF"; // PDF etiket
})(HepsiJetLabelFormat || (exports.HepsiJetLabelFormat = HepsiJetLabelFormat = {}));
/**
 * HepsiJet teslim edilememe nedenleri
 * `not_delivered` durumundaki shipment'lar icin dogrulama
 */
var HepsiJetFailureReason;
(function (HepsiJetFailureReason) {
    HepsiJetFailureReason["ADDRESS_NOT_FOUND"] = "ADDRESS_NOT_FOUND";
    HepsiJetFailureReason["RECIPIENT_NOT_AVAILABLE"] = "RECIPIENT_NOT_AVAILABLE";
    HepsiJetFailureReason["REFUSED"] = "REFUSED";
    HepsiJetFailureReason["DAMAGED"] = "DAMAGED";
    HepsiJetFailureReason["INCORRECT_PAYMENT"] = "INCORRECT_PAYMENT";
    HepsiJetFailureReason["OTHER"] = "OTHER"; // Diger
})(HepsiJetFailureReason || (exports.HepsiJetFailureReason = HepsiJetFailureReason = {}));
/**
 * HepsiJet durumlarini Moon Project standart `deliveryStatus` degerlerine cevirir.
 *
 * Moon standart degerleri:
 * - pending, in_transit, out_for_delivery, delivered, cancelled,
 *   returned, not_delivered, unknown
 */
function mapHepsiJetStatusToDeliveryStatus(status) {
    if (!status)
        return 'unknown';
    const normalized = status.toString().toUpperCase();
    const statusMap = {
        [HepsiJetDeliveryStatus.CREATED]: 'pending',
        [HepsiJetDeliveryStatus.COLLECTED]: 'in_transit',
        [HepsiJetDeliveryStatus.IN_TRANSFER_HUB]: 'in_transit',
        [HepsiJetDeliveryStatus.OUT_FOR_DELIVERY]: 'out_for_delivery',
        [HepsiJetDeliveryStatus.DELIVERING]: 'out_for_delivery',
        [HepsiJetDeliveryStatus.DELIVERED]: 'delivered',
        [HepsiJetDeliveryStatus.NOT_DELIVERED]: 'not_delivered',
        [HepsiJetDeliveryStatus.RETURNED_TO_HUB]: 'in_transit',
        [HepsiJetDeliveryStatus.RETURNED_TO_SENDER]: 'returned',
        [HepsiJetDeliveryStatus.CANCELLED]: 'cancelled',
        [HepsiJetDeliveryStatus.UNKNOWN]: 'unknown'
    };
    return statusMap[normalized] || 'unknown';
}
//# sourceMappingURL=hepsijet-status.enum.js.map