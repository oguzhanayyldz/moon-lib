"use strict";
/**
 * Yurtiçi Kargo Durum Kodları
 * Kaynak: Yurtiçi Kargo API Dökümanı - Bölüm 4
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.YurticiCollectionType = exports.YurticiQueryKeyType = exports.YurticiErrorCode = exports.YurticiReturnStatus = exports.YurticiRejectStatus = exports.YurticiOperationStatus = void 0;
/**
 * Yurtiçi Kargo Operasyon Statüleri (operationStatus)
 * Kargonun genel durumunu belirtir
 */
var YurticiOperationStatus;
(function (YurticiOperationStatus) {
    YurticiOperationStatus[YurticiOperationStatus["NOP"] = 0] = "NOP";
    YurticiOperationStatus[YurticiOperationStatus["IND"] = 1] = "IND";
    YurticiOperationStatus[YurticiOperationStatus["ISR"] = 2] = "ISR";
    YurticiOperationStatus[YurticiOperationStatus["CNL"] = 3] = "CNL";
    YurticiOperationStatus[YurticiOperationStatus["DLV"] = 5] = "DLV"; // Kargo Teslim edilmiştir
})(YurticiOperationStatus || (exports.YurticiOperationStatus = YurticiOperationStatus = {}));
/**
 * Yurtiçi Kargo İade Durum Kodları (rejectStatus)
 * Kargo iade sürecindeyse dönen kodlar
 */
var YurticiRejectStatus;
(function (YurticiRejectStatus) {
    YurticiRejectStatus[YurticiRejectStatus["REQUESTED"] = 0] = "REQUESTED";
    YurticiRejectStatus[YurticiRejectStatus["ORIGIN_APPROVED"] = 1] = "ORIGIN_APPROVED";
    YurticiRejectStatus[YurticiRejectStatus["REGION_APPROVED"] = 2] = "REGION_APPROVED";
    YurticiRejectStatus[YurticiRejectStatus["COMPLETED"] = 9] = "COMPLETED";
    YurticiRejectStatus[YurticiRejectStatus["CLOSED"] = 10] = "CLOSED"; // İade Sonlandırıldı
})(YurticiRejectStatus || (exports.YurticiRejectStatus = YurticiRejectStatus = {}));
/**
 * Yurtiçi Kargo Geri Dönüş Durumu (returnStatus)
 * Kargo teslim edilemediyse veya geri dönüşlü evrak varsa
 */
var YurticiReturnStatus;
(function (YurticiReturnStatus) {
    YurticiReturnStatus[YurticiReturnStatus["NOT_DELIVERED_NO_INVOICE"] = 0] = "NOT_DELIVERED_NO_INVOICE";
    YurticiReturnStatus[YurticiReturnStatus["DELIVERED_NO_INVOICE"] = 1] = "DELIVERED_NO_INVOICE";
    YurticiReturnStatus[YurticiReturnStatus["DELIVERED_INVOICED"] = 2] = "DELIVERED_INVOICED";
    YurticiReturnStatus[YurticiReturnStatus["RETURNED_TO_SENDER"] = 3] = "RETURNED_TO_SENDER"; // Gönderici Müşteriye İade Edildi
})(YurticiReturnStatus || (exports.YurticiReturnStatus = YurticiReturnStatus = {}));
/**
 * Yurtiçi Kargo Hata Kodları (errCode)
 * Sık karşılaşılan hata kodları
 */
var YurticiErrorCode;
(function (YurticiErrorCode) {
    YurticiErrorCode[YurticiErrorCode["SUCCESS"] = 0] = "SUCCESS";
    YurticiErrorCode[YurticiErrorCode["UNEXPECTED_ERROR"] = 936] = "UNEXPECTED_ERROR";
    YurticiErrorCode[YurticiErrorCode["DUPLICATE_CARGO_KEY"] = 60020] = "DUPLICATE_CARGO_KEY";
    YurticiErrorCode[YurticiErrorCode["CARGO_KEY_NOT_FOUND"] = 80859] = "CARGO_KEY_NOT_FOUND";
    YurticiErrorCode[YurticiErrorCode["RECEIVER_ADDRESS_NOT_FOUND"] = 60019] = "RECEIVER_ADDRESS_NOT_FOUND"; // Alıcı adresi bulunamadı
})(YurticiErrorCode || (exports.YurticiErrorCode = YurticiErrorCode = {}));
/**
 * Yurtiçi Query KeyType
 * queryShipment metodunda kullanılan sorgulama tipi
 */
var YurticiQueryKeyType;
(function (YurticiQueryKeyType) {
    YurticiQueryKeyType[YurticiQueryKeyType["CARGO_KEY"] = 0] = "CARGO_KEY";
    YurticiQueryKeyType[YurticiQueryKeyType["TRACKING_NUMBER"] = 1] = "TRACKING_NUMBER"; // Tracking number ile sorgulama (varsa)
})(YurticiQueryKeyType || (exports.YurticiQueryKeyType = YurticiQueryKeyType = {}));
/**
 * Yurtiçi COD (Kapıda Ödeme) Payment Type
 * Tahsilatlı gönderi ödeme tipi
 */
var YurticiCollectionType;
(function (YurticiCollectionType) {
    YurticiCollectionType["CASH"] = "0";
    YurticiCollectionType["CREDIT_CARD"] = "1"; // Kredi Kartı
})(YurticiCollectionType || (exports.YurticiCollectionType = YurticiCollectionType = {}));
