import { Subjects } from "./subjects";
import { InvoiceStatus, InvoiceCategory } from "./types/invoice-status";

export interface SubscriptionInvoiceCreatedEvent {
    subject: Subjects.SubscriptionInvoiceCreated;
    data: {
        id: string;
        uuid: string;
        user: string;
        version: number;
        subscriptionId: string;
        paymentId: string;

        // Fatura bilgileri
        status: InvoiceStatus;
        category: InvoiceCategory;
        amount: number;
        currency: string;
        taxRate: number;
        taxAmount: number;
        subtotal: number;

        // Fatura periyodu
        billingPeriodStart: Date;
        billingPeriodEnd: Date;
        issueDate: Date;

        // Fatura alicisi bilgileri
        billing: {
            companyName?: string;
            taxNumber?: string;
            taxOffice?: string;
            name?: string;
            surname?: string;
            email?: string;
            phone?: string;
            address?: {
                line1?: string;
                line2?: string;
                city?: string;
                district?: string;
                postalCode?: string;
                country?: string;
            };
        };

        // ERP bilgileri (sonradan dolar)
        erpPlatform?: string;
        erpId?: string;
        erpInvoiceId?: string;

        // PDF/XML linkleri (resmilestirme sonrasi dolar)
        pdfUrl?: string;
        xmlUrl?: string;
        gibUuid?: string;
        gibEttn?: string;

        timestamp: Date;
    };
}
