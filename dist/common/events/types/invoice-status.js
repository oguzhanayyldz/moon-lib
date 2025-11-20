"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceCategory = exports.InvoiceType = exports.InvoiceStatus = void 0;
/**
 * Invoice Status Enum
 * Fatura durumlarını tanımlar
 */
var InvoiceStatus;
(function (InvoiceStatus) {
    /**
     * Taslak - Fatura oluşturuldu ama henüz ERP'ye gönderilmedi
     */
    InvoiceStatus["DRAFT"] = "DRAFT";
    /**
     * İşlemde - ERP'ye gönderildi, resmileştirme işlemi devam ediyor
     */
    InvoiceStatus["PROCESSING"] = "PROCESSING";
    /**
     * Resmileştirildi - E-Arşiv/E-Fatura numarası alındı
     */
    InvoiceStatus["FORMALIZED"] = "FORMALIZED";
    /**
     * Başarısız - Resmileştirme işlemi başarısız oldu
     */
    InvoiceStatus["FAILED"] = "FAILED";
    /**
     * İptal Edildi - Fatura iptal edildi
     */
    InvoiceStatus["CANCELLED"] = "CANCELLED";
})(InvoiceStatus || (exports.InvoiceStatus = InvoiceStatus = {}));
/**
 * Invoice Type Enum
 * Fatura türlerini tanımlar
 */
var InvoiceType;
(function (InvoiceType) {
    /**
     * Satış Faturası
     */
    InvoiceType["SALES"] = "SALES";
    /**
     * İade Faturası
     */
    InvoiceType["RETURN"] = "RETURN";
    /**
     * Proforma Fatura
     */
    InvoiceType["PROFORMA"] = "PROFORMA";
})(InvoiceType || (exports.InvoiceType = InvoiceType = {}));
/**
 * Invoice Category Enum
 * E-Fatura kategorileri
 */
var InvoiceCategory;
(function (InvoiceCategory) {
    /**
     * E-Arşiv Fatura (Bireysel müşteriler için)
     */
    InvoiceCategory["E_ARCHIVE"] = "E_ARCHIVE";
    /**
     * E-Fatura (Kurumsal müşteriler için)
     */
    InvoiceCategory["E_INVOICE"] = "E_INVOICE";
    /**
     * İhracat Faturası
     */
    InvoiceCategory["EXPORT"] = "EXPORT";
})(InvoiceCategory || (exports.InvoiceCategory = InvoiceCategory = {}));
