/**
 * Standart entegrasyon parametre tipleri
 *
 * Tüm marketplace ve ecommerce entegrasyonlarının
 * ortak kullandığı parametre ve sonuç tipleri.
 */

// === Parametre Tipleri ===

export interface SendTrackingParams {
    /** Platform paket/fulfillment ID */
    packageId: string;
    /** Kargo takip numarası */
    trackingNumber: string;
    /** Takip linki */
    trackingUrl?: string;
    /** Kargo firması adı */
    cargoCompany?: string;
    /** Kargoya verilme tarihi (ISO 8601) */
    shippedDate?: string;
}

export interface SendDeliveryStatusParams {
    /** Platform paket/fulfillment ID */
    packageId: string;
    /** Teslim tarihi (ISO 8601) */
    deliveredDate: string;
    /** Teslim alan kişi */
    receivedBy?: string;
}

export interface GetShippingLabelParams {
    /** Kargo takip numarası */
    trackingNumber: string;
    /** Etiket formatı */
    format?: 'ZPL' | 'PDF' | 'PNG';
}

export interface SendInvoiceParams {
    /** Platform paket/fulfillment ID */
    packageId: string;
    /** Fatura linki */
    invoiceLink: string;
    /** Fatura numarası */
    invoiceNumber?: string;
}

// === Sonuç Tipleri ===

export interface IntegrationResult {
    success: boolean;
    message?: string;
    data?: any;
}

export interface ShippingLabelResult {
    success: boolean;
    labelData?: string;
    format?: string;
}
