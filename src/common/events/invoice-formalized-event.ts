import { Subjects } from "./subjects";
import { InvoiceCategory } from "./types/invoice-status";
import { CurrencyCode } from "../types/currency-code";
import { ResourceName } from "../types/resourceName";

export interface InvoiceFormalizedEvent {
    subject: Subjects.InvoiceFormalized;
    data: {
        list: InvoiceFormalized[];
        userId: string;
    };
}

export interface InvoiceFormalized {
    id: string; // Invoice MongoDB ID
    uuid: string;
    user: string;
    version: number;

    // Order referansı (complete - Orders service'de order.fields güncellemesi için)
    order: {
        id: string;
        uuid: string;
        version: number;
        purchaseNumber: string; // Bizim sistemdeki sipariş numarası
        platformNumber: string; // Platform'dan gelen sipariş numarası
        platform: ResourceName; // Hangi platformdan geldi
    };

    // Resmileştirilmiş fatura bilgileri
    invoiceNumber: string; // e-Arşiv/e-Fatura numarası (GİB'den gelen)
    category: InvoiceCategory; // E_ARCHIVE, E_INVOICE, EXPORT

    // ERP bilgileri
    erpPlatform: string; // Parasut, Logo, SAP, Netsis, etc.
    erpId: string; // ERP'deki fatura ID'si
    erpInvoiceId?: string; // ERP'deki invoice_id (bazı ERP'lerde farklı olabilir)

    // Resmileştirme bilgileri
    formalizedAt: Date; // Resmileştirme tarihi
    issueDate: Date; // Fatura tarihi

    // PDF ve XML linkleri (varsa)
    pdfUrl?: string;
    xmlUrl?: string;
    printUrl?: string;

    // GİB bilgileri (Türkiye için)
    gibUuid?: string; // GİB'deki fatura UUID'si
    gibEttn?: string; // E-Fatura ETTN (Elektronik Transfer Takip Numarası)

    // Tutar bilgileri (Orders service'de order.fields güncelleme için)
    amounts: {
        total: number; // Genel toplam
        subtotal: number; // KDV hariç toplam
        taxTotal: number; // KDV toplamı
        currency: CurrencyCode;
    };

    // Müşteri bilgileri özeti (loglama ve bildirim için)
    customer: {
        name: string;
        surname: string;
        email?: string;
        taxNumber?: string;
        companyName?: string;
    };

    // Ek alanlar
    fields?: Record<string, any>;

    // İşlem zamanı
    timestamp: Date;
}
