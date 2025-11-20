import { Subjects } from "./subjects";
import { ResourceName } from "../types/resourceName";
import { InvoiceCategory } from "./types/invoice-status";

export interface InvoiceFailedEvent {
    subject: Subjects.InvoiceFailed;
    data: {
        list: InvoiceFailed[];
        userId: string;
    };
}

export interface InvoiceFailed {
    id: string; // Invoice MongoDB ID
    uuid: string;
    user: string;
    version: number;

    // Order referansı (complete - bildirim ve loglama için)
    order: {
        id: string;
        uuid: string;
        version: number;
        purchaseNumber: string; // Bizim sistemdeki sipariş numarası
        platformNumber: string; // Platform'dan gelen sipariş numarası
        platform: ResourceName; // Hangi platformdan geldi
    };

    // Fatura bilgileri
    category?: InvoiceCategory; // Hangi kategoride fatura kesilmeye çalışıldı

    // ERP bilgileri
    erpPlatform?: string; // Parasut, Logo, SAP, Netsis, etc.
    erpId?: string; // ERP'deki fatura ID'si (varsa - partial success durumunda)

    // Hata bilgileri
    error: {
        code: string; // Hata kodu (örn: ERP_CONNECTION_ERROR, VALIDATION_ERROR, TAX_NUMBER_INVALID, etc.)
        message: string; // Kullanıcıya gösterilecek hata mesajı
        details?: Record<string, any>; // Ek hata detayları (debug için)
        stackTrace?: string; // Stack trace (sadece development/test için)
    };

    // Retry bilgileri
    retryCount: number; // Kaç kez denendi
    maxRetries: number; // Maksimum deneme sayısı
    willRetry: boolean; // Tekrar denenecek mi?
    nextRetryAt?: Date; // Sonraki deneme zamanı (willRetry: true ise)

    // Müşteri bilgileri özeti (bildirim için)
    customer: {
        name: string;
        surname: string;
        email?: string;
        taxNumber?: string;
        companyName?: string;
    };

    // İşlem zamanı
    failedAt: Date;
    timestamp: Date;

    // Ek alanlar
    fields?: Record<string, any>;
}
