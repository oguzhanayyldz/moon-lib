"use strict";
/**
 * HepsiJet Kargo Enum'lari
 * Kaynak: HepsiJet Developer Docs (docs/integrations/hepsijet/)
 *
 * Bu dosyadaki enum degerleri GERCEK API response'larinda donen degerlerdir.
 * Doc: 12-getDeliveryTracking-rest.md, 03-sendDeliveryOrderEnhanced.md
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HEPSIJET_COMPANY_DEFAULTS = exports.HepsiJetFailureReason = exports.HepsiJetLabelFormat = exports.HepsiJetDeliverySlot = exports.HepsiJetProductCode = exports.HepsiJetDeliveryType = exports.HepsiJetTransactionType = exports.HepsiJetOperationStatus = exports.HepsiJetDeliveryStatus = void 0;
exports.mapHepsiJetStatusToDeliveryStatus = mapHepsiJetStatusToDeliveryStatus;
/**
 * HepsiJet Teslimat Durumlari (deliveryStatus)
 * Kaynak: docs/integrations/hepsijet/12-getDeliveryTracking-rest.md
 */
var HepsiJetDeliveryStatus;
(function (HepsiJetDeliveryStatus) {
    HepsiJetDeliveryStatus["COLLECTED"] = "COLLECTED";
    HepsiJetDeliveryStatus["TRANSFERRING_COLLECT"] = "TRANSFERRING_COLLECT";
    HepsiJetDeliveryStatus["READY"] = "READY";
    HepsiJetDeliveryStatus["WAITING_FOR_DISPATCH"] = "WAITING_FOR_DISPATCH";
    HepsiJetDeliveryStatus["DELIVERING"] = "DELIVERING";
    HepsiJetDeliveryStatus["DELIVERED"] = "DELIVERED";
    HepsiJetDeliveryStatus["UNDELIVERED"] = "UNDELIVERED";
    HepsiJetDeliveryStatus["RETURNED"] = "RETURNED";
    HepsiJetDeliveryStatus["CANCELLED"] = "CANCELLED"; // Iptal edildi
})(HepsiJetDeliveryStatus || (exports.HepsiJetDeliveryStatus = HepsiJetDeliveryStatus = {}));
/**
 * HepsiJet Operasyon Durumlari (operationStatus)
 * Kaynak: docs/integrations/hepsijet/12-getDeliveryTracking-rest.md
 */
var HepsiJetOperationStatus;
(function (HepsiJetOperationStatus) {
    HepsiJetOperationStatus["IN_DELIVERY_TRANSIT"] = "IN_DELIVERY_TRANSIT";
    HepsiJetOperationStatus["IN_RING_TRANSIT"] = "IN_RING_TRANSIT";
    HepsiJetOperationStatus["IN_RING_VEHICLE"] = "IN_RING_VEHICLE";
    HepsiJetOperationStatus["IN_XDOCK"] = "IN_XDOCK";
    HepsiJetOperationStatus["IN_RECIPIENT"] = "IN_RECIPIENT";
    HepsiJetOperationStatus["IN_RETURN_TRANSIT"] = "IN_RETURN_TRANSIT"; // Iade transferinde
})(HepsiJetOperationStatus || (exports.HepsiJetOperationStatus = HepsiJetOperationStatus = {}));
/**
 * HepsiJet Transaction Type (gonderinin hareket tipi)
 * Kaynak: docs/integrations/hepsijet/12-getDeliveryTracking-rest.md
 */
var HepsiJetTransactionType;
(function (HepsiJetTransactionType) {
    HepsiJetTransactionType["TAKE_CUSTODY"] = "TAKE_CUSTODY";
    HepsiJetTransactionType["APPROVE_RING_DEPART"] = "APPROVE_RING_DEPART";
    HepsiJetTransactionType["APPROVE_RING_ARRIVE"] = "APPROVE_RING_ARRIVE";
    HepsiJetTransactionType["UNLOAD_RING_VEHICLE"] = "UNLOAD_RING_VEHICLE";
    HepsiJetTransactionType["APPROVE_COURIER_DEPART"] = "APPROVE_COURIER_DEPART";
    HepsiJetTransactionType["DELIVERY_ATTEMPT"] = "DELIVERY_ATTEMPT"; // Teslimat denemesi
})(HepsiJetTransactionType || (exports.HepsiJetTransactionType = HepsiJetTransactionType = {}));
/**
 * HepsiJet Teslimat Tipi (deliveryType)
 * Kaynak: docs/integrations/hepsijet/03-sendDeliveryOrderEnhanced.md
 */
var HepsiJetDeliveryType;
(function (HepsiJetDeliveryType) {
    HepsiJetDeliveryType["RETAIL"] = "RETAIL";
    HepsiJetDeliveryType["MARKET_PLACE"] = "MARKET_PLACE";
    HepsiJetDeliveryType["RETURNED"] = "RETURNED"; // Iade gonderi
})(HepsiJetDeliveryType || (exports.HepsiJetDeliveryType = HepsiJetDeliveryType = {}));
/**
 * HepsiJet Product Code (teslimat urun kodu)
 * Kaynak: docs/integrations/hepsijet/03-sendDeliveryOrderEnhanced.md
 *
 * NOT: Onceki versiyondaki "serviceType" (STANDARD/TMH/POD/APPOINTMENT) dokumantasyona uymuyordu.
 * Gercek API payload'inda delivery.product.productCode kullanilir.
 */
var HepsiJetProductCode;
(function (HepsiJetProductCode) {
    HepsiJetProductCode["HX_STD"] = "HX_STD";
    HepsiJetProductCode["HX_SD"] = "HX_SD";
    HepsiJetProductCode["HX_ND"] = "HX_ND"; // Ertesi Gun Teslimat
})(HepsiJetProductCode || (exports.HepsiJetProductCode = HepsiJetProductCode = {}));
/**
 * HepsiJet Delivery Slot (teslimat saat dilimi)
 * Kaynak: docs/integrations/hepsijet/03-sendDeliveryOrderEnhanced.md
 */
var HepsiJetDeliverySlot;
(function (HepsiJetDeliverySlot) {
    HepsiJetDeliverySlot["STANDARD"] = "0";
    HepsiJetDeliverySlot["SLOT_1"] = "1";
    HepsiJetDeliverySlot["SLOT_2"] = "2";
    HepsiJetDeliverySlot["SLOT_3"] = "3"; // 18:00 - 23:00 arasi
})(HepsiJetDeliverySlot || (exports.HepsiJetDeliverySlot = HepsiJetDeliverySlot = {}));
/**
 * HepsiJet Label Format
 * ZPL: GET /delivery/generateZplBarcode/{barcode}/{totalParcel}
 * PDF: POST /delivery/barcodes/label
 */
var HepsiJetLabelFormat;
(function (HepsiJetLabelFormat) {
    HepsiJetLabelFormat["ZPL"] = "ZPL";
    HepsiJetLabelFormat["PDF"] = "PDF";
})(HepsiJetLabelFormat || (exports.HepsiJetLabelFormat = HepsiJetLabelFormat = {}));
/**
 * HepsiJet teslim edilememe nedenleri (nonDeliveryReason)
 * Kaynak: docs/integrations/hepsijet/12-getDeliveryTracking-rest.md
 */
var HepsiJetFailureReason;
(function (HepsiJetFailureReason) {
    HepsiJetFailureReason["RECIPIENT_NOT_FOUND"] = "RECIPIENT_NOT_FOUND";
    HepsiJetFailureReason["ADDRESS_NOT_FOUND"] = "ADDRESS_NOT_FOUND";
    HepsiJetFailureReason["RECIPIENT_NOT_AVAILABLE"] = "RECIPIENT_NOT_AVAILABLE";
    HepsiJetFailureReason["REFUSED"] = "REFUSED";
    HepsiJetFailureReason["DAMAGED"] = "DAMAGED";
    HepsiJetFailureReason["INCORRECT_PAYMENT"] = "INCORRECT_PAYMENT";
    HepsiJetFailureReason["OTHER"] = "OTHER";
})(HepsiJetFailureReason || (exports.HepsiJetFailureReason = HepsiJetFailureReason = {}));
/**
 * HepsiJet Sabitleri (doc'ta her request'te SABIT degerler olarak beklenen)
 * Kaynak: docs/integrations/hepsijet/03-sendDeliveryOrderEnhanced.md (company + senderAddress sabit)
 *
 * Bu degerler HepsiJet tarafinda satici firma icin tanimli oldugu icin sabittir.
 * Moon tarafinda credential olarak alinmaz.
 */
exports.HEPSIJET_COMPANY_DEFAULTS = {
    name: "Hepsijet_Firmasi",
    abbreviationCode: "Hpsjet_Frmsi"
};
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
        [HepsiJetDeliveryStatus.COLLECTED]: 'in_transit',
        [HepsiJetDeliveryStatus.TRANSFERRING_COLLECT]: 'in_transit',
        [HepsiJetDeliveryStatus.READY]: 'pending',
        [HepsiJetDeliveryStatus.WAITING_FOR_DISPATCH]: 'pending',
        [HepsiJetDeliveryStatus.DELIVERING]: 'out_for_delivery',
        [HepsiJetDeliveryStatus.DELIVERED]: 'delivered',
        [HepsiJetDeliveryStatus.UNDELIVERED]: 'not_delivered',
        [HepsiJetDeliveryStatus.RETURNED]: 'returned',
        [HepsiJetDeliveryStatus.CANCELLED]: 'cancelled'
    };
    return statusMap[normalized] || 'unknown';
}
