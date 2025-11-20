/**
 * Invoice Status Enum
 * Fatura durumlarını tanımlar
 */
export declare enum InvoiceStatus {
    /**
     * Taslak - Fatura oluşturuldu ama henüz ERP'ye gönderilmedi
     */
    DRAFT = "DRAFT",
    /**
     * İşlemde - ERP'ye gönderildi, resmileştirme işlemi devam ediyor
     */
    PROCESSING = "PROCESSING",
    /**
     * Resmileştirildi - E-Arşiv/E-Fatura numarası alındı
     */
    FORMALIZED = "FORMALIZED",
    /**
     * Başarısız - Resmileştirme işlemi başarısız oldu
     */
    FAILED = "FAILED",
    /**
     * İptal Edildi - Fatura iptal edildi
     */
    CANCELLED = "CANCELLED"
}
/**
 * Invoice Type Enum
 * Fatura türlerini tanımlar
 */
export declare enum InvoiceType {
    /**
     * Satış Faturası
     */
    SALES = "SALES",
    /**
     * İade Faturası
     */
    RETURN = "RETURN",
    /**
     * Proforma Fatura
     */
    PROFORMA = "PROFORMA"
}
/**
 * Invoice Category Enum
 * E-Fatura kategorileri
 */
export declare enum InvoiceCategory {
    /**
     * E-Arşiv Fatura (Bireysel müşteriler için)
     */
    E_ARCHIVE = "E_ARCHIVE",
    /**
     * E-Fatura (Kurumsal müşteriler için)
     */
    E_INVOICE = "E_INVOICE",
    /**
     * İhracat Faturası
     */
    EXPORT = "EXPORT"
}
