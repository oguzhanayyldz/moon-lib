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
    id: string;
    uuid: string;
    user: string;
    version: number;
    order: {
        id: string;
        uuid: string;
        version: number;
        purchaseNumber: string;
        platformNumber: string;
        platform: ResourceName;
    };
    invoiceNumber?: string;
    status: InvoiceStatus;
    type?: string;
    category: InvoiceCategory;
    erpPlatform?: string;
    erpId?: string;
    erpInvoiceId?: string;
    erpStatus?: string;
    amounts?: {
        subtotal: number;
        taxTotal: number;
        total: number;
        currency: CurrencyCode;
    };
    issueDate?: Date;
    formalizedAt?: Date;
    pdfUrl?: string;
    xmlUrl?: string;
    printUrl?: string;
    gibUuid?: string;
    gibEttn?: string;
    customer?: {
        name: string;
        surname?: string;
        email?: string;
        taxNumber?: string;
        companyName?: string;
    };
    error?: {
        code: string;
        message: string;
        stage?: string;
    };
    retryCount?: number;
    willRetry?: boolean;
    nextRetryAt?: Date;
    fields?: Record<string, any>;
    timestamp: Date;
}
//# sourceMappingURL=invoice-updated-event.d.ts.map