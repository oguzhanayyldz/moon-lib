import { ResourceName, CurrencyCode } from '../';
/**
 * ERP platformları arası ortak fatura veri modeli
 * Bu model, farklı ERP platformlarına (Parasut, Logo, SAP, Netsis, etc.)
 * aktarılacak fatura verilerini standartlaştırır.
 */
export interface CommonInvoiceExport {
    id: string;
    uuid: string;
    externalId?: string;
    order: {
        id: string;
        uuid: string;
        purchaseNumber: string;
        platformNumber: string;
        platform: ResourceName;
        date: Date;
    };
    invoiceType: 'SALES' | 'RETURN' | 'PROFORMA';
    invoiceCategory: 'E_ARCHIVE' | 'E_INVOICE' | 'EXPORT';
    customer: {
        name: string;
        surname: string;
        email?: string;
        phone?: string;
        taxNumber?: string;
        taxOffice?: string;
        identityNumber?: string;
        companyName?: string;
        address: {
            country: string;
            city: string;
            district?: string;
            addressLine1: string;
            addressLine2?: string;
            postalCode?: string;
        };
    };
    items: Array<{
        productId?: string;
        combinationId?: string;
        externalId?: string;
        name: string;
        sku: string;
        barcode?: string;
        code?: string;
        quantity: number;
        unitPrice: number;
        unitPriceWithTax: number;
        taxRate: number;
        taxAmount: number;
        discountRate?: number;
        discountAmount?: number;
        totalAmount: number;
        totalWithoutTax: number;
    }>;
    amounts: {
        subtotal: number;
        taxTotal: number;
        discountTotal: number;
        shippingTotal: number;
        shippingTaxRate?: number;
        total: number;
        currency: CurrencyCode;
    };
    issueDate: Date;
    dueDate?: Date;
    description?: string;
    notes?: string;
    metadata?: Record<string, any>;
}
/**
 * Fatura aktarım isteği için girdi modeli
 */
export interface InvoiceExportRequest {
    invoiceId: string;
    erpPlatform: string;
    operation: 'create' | 'update';
    userId: string;
    platformParams?: Record<string, any>;
}
/**
 * Fatura aktarım sonucu için çıktı modeli
 */
export interface InvoiceExportResult {
    success: boolean;
    externalId?: string;
    erpInvoiceId?: string;
    invoiceNumber?: string;
    pdfUrl?: string;
    xmlUrl?: string;
    printUrl?: string;
    gibUuid?: string;
    gibEttn?: string;
    formalizedAt?: Date;
    error?: {
        code: string;
        message: string;
        details?: Record<string, any>;
    };
    platformResponse?: Record<string, any>;
}
/**
 * Fatura iptal isteği modeli
 */
export interface InvoiceCancelRequest {
    invoiceId: string;
    externalId: string;
    erpPlatform: string;
    userId: string;
    reason?: string;
    platformParams?: Record<string, any>;
}
/**
 * Fatura iptal sonucu modeli
 */
export interface InvoiceCancelResult {
    success: boolean;
    error?: string;
    platformResponse?: Record<string, any>;
}
//# sourceMappingURL=invoice-export.interface.d.ts.map