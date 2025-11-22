import { Subjects } from "./subjects";
import { InvoiceStatus, InvoiceCategory } from "./types/invoice-status";
import { CurrencyCode } from "../types/currency-code";
import { ResourceName } from "../types/resourceName";

/**
 * InvoiceUpdatedEvent - Invoice güncellendiğinde yayınlanır
 *
 * Kullanım senaryoları:
 * - Sales invoice oluşturuldu ama henüz resmileştirilmedi (erpInvoiceId, erpStatus güncellendi)
 * - Fatura durumu değişti (status, erpStatus)
 * - Hata bilgileri güncellendi
 *
 * Not: Formalized ve Failed durumları için ayrı event'ler kullanılır
 */
export interface InvoiceUpdatedEvent {
    subject: Subjects.InvoiceUpdated;
    data: {
        list: InvoiceUpdated[];
        userId: string;
    };
}

export interface InvoiceUpdated {
    id: string; // Invoice MongoDB ID
    uuid: string;
    user: string;
    version: number;

    // Order referansı (minimal)
    order: {
        id: string;
        uuid: string;
        version: number;
        purchaseNumber: string;
        platformNumber: string;
        platform: ResourceName;
    };

    // Fatura bilgileri
    invoiceNumber?: string;
    status: InvoiceStatus;
    type?: string;
    category: InvoiceCategory;

    // ERP bilgileri - güncellenen kritik alanlar
    erpPlatform?: string;
    erpId?: string;
    erpInvoiceId?: string; // Sales invoice ID (Parasut'taki satış faturası ID'si)
    erpStatus?: string; // CREATED, FORMALIZED, FORMALIZE_FAILED, CREATE_FAILED

    // Tutar bilgileri
    amounts?: {
        subtotal: number;
        taxTotal: number;
        total: number;
        currency: CurrencyCode;
    };

    // Tarihler
    issueDate?: Date;
    formalizedAt?: Date;

    // PDF/XML linkleri
    pdfUrl?: string;
    xmlUrl?: string;
    printUrl?: string;

    // GİB bilgileri
    gibUuid?: string;
    gibEttn?: string;

    // Müşteri bilgileri (minimal)
    customer?: {
        name: string;
        surname?: string;
        email?: string;
        taxNumber?: string;
        companyName?: string;
    };

    // Hata bilgileri (opsiyonel)
    error?: {
        code: string;
        message: string;
        stage?: string; // 'create' | 'formalize'
    };

    // Retry bilgileri
    retryCount?: number;
    willRetry?: boolean;
    nextRetryAt?: Date;

    // Ek alanlar
    fields?: Record<string, any>;

    // Timestamp
    timestamp: Date;
}
