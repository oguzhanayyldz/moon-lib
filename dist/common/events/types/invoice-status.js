"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceCategory = exports.InvoiceErpStatus = exports.InvoiceType = exports.InvoiceStatus = void 0;
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
 * Invoice ERP Status Enum
 * ERP'deki fatura işlem aşamalarını tanımlar
 */
var InvoiceErpStatus;
(function (InvoiceErpStatus) {
    /**
     * Bekliyor - Henüz ERP'ye gönderilmedi
     */
    InvoiceErpStatus["PENDING"] = "PENDING";
    /**
     * Oluşturuluyor - ERP'de sales invoice oluşturuluyor
     */
    InvoiceErpStatus["CREATING"] = "CREATING";
    /**
     * Oluşturuldu - ERP'de sales invoice oluşturuldu, resmileştirme bekleniyor
     */
    InvoiceErpStatus["CREATED"] = "CREATED";
    /**
     * Resmileştiriliyor - E-Arşiv/E-Fatura dönüşümü yapılıyor
     */
    InvoiceErpStatus["FORMALIZING"] = "FORMALIZING";
    /**
     * Resmileştirildi - E-Arşiv/E-Fatura numarası alındı
     */
    InvoiceErpStatus["FORMALIZED"] = "FORMALIZED";
    /**
     * Oluşturma Başarısız - Sales invoice oluşturma başarısız
     */
    InvoiceErpStatus["CREATE_FAILED"] = "CREATE_FAILED";
    /**
     * Resmileştirme Başarısız - E-Arşiv/E-Fatura dönüşümü başarısız
     */
    InvoiceErpStatus["FORMALIZE_FAILED"] = "FORMALIZE_FAILED";
})(InvoiceErpStatus || (exports.InvoiceErpStatus = InvoiceErpStatus = {}));
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
