/**
 * Invoice Status Enum
 * Fatura durumlarını tanımlar
 */
export enum InvoiceStatus {
    /**
     * Taslak - Fatura oluşturuldu ama henüz ERP'ye gönderilmedi
     */
    DRAFT = 'DRAFT',

    /**
     * İşlemde - ERP'ye gönderildi, resmileştirme işlemi devam ediyor
     */
    PROCESSING = 'PROCESSING',

    /**
     * Resmileştirildi - E-Arşiv/E-Fatura numarası alındı
     */
    FORMALIZED = 'FORMALIZED',

    /**
     * Başarısız - Resmileştirme işlemi başarısız oldu
     */
    FAILED = 'FAILED',

    /**
     * İptal Edildi - Fatura iptal edildi
     */
    CANCELLED = 'CANCELLED',
}

/**
 * Invoice Type Enum
 * Fatura türlerini tanımlar
 */
export enum InvoiceType {
    /**
     * Satış Faturası
     */
    SALES = 'SALES',

    /**
     * İade Faturası
     */
    RETURN = 'RETURN',

    /**
     * Proforma Fatura
     */
    PROFORMA = 'PROFORMA',
}

/**
 * Invoice ERP Status Enum
 * ERP'deki fatura işlem aşamalarını tanımlar
 */
export enum InvoiceErpStatus {
    /**
     * Bekliyor - Henüz ERP'ye gönderilmedi
     */
    PENDING = 'PENDING',

    /**
     * Oluşturuluyor - ERP'de sales invoice oluşturuluyor
     */
    CREATING = 'CREATING',

    /**
     * Oluşturuldu - ERP'de sales invoice oluşturuldu, resmileştirme bekleniyor
     */
    CREATED = 'CREATED',

    /**
     * Resmileştiriliyor - E-Arşiv/E-Fatura dönüşümü yapılıyor
     */
    FORMALIZING = 'FORMALIZING',

    /**
     * Resmileştirildi - E-Arşiv/E-Fatura numarası alındı
     */
    FORMALIZED = 'FORMALIZED',

    /**
     * Oluşturma Başarısız - Sales invoice oluşturma başarısız
     */
    CREATE_FAILED = 'CREATE_FAILED',

    /**
     * Resmileştirme Başarısız - E-Arşiv/E-Fatura dönüşümü başarısız
     */
    FORMALIZE_FAILED = 'FORMALIZE_FAILED',
}

/**
 * Invoice Category Enum
 * E-Fatura kategorileri
 */
export enum InvoiceCategory {
    /**
     * E-Arşiv Fatura (Bireysel müşteriler için)
     */
    E_ARCHIVE = 'E_ARCHIVE',

    /**
     * E-Fatura (Kurumsal müşteriler için)
     */
    E_INVOICE = 'E_INVOICE',

    /**
     * İhracat Faturası
     */
    EXPORT = 'EXPORT',
}
