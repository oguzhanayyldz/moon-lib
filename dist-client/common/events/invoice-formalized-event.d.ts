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
    invoiceNumber: string;
    category: InvoiceCategory;
    erpPlatform: string;
    erpId: string;
    erpInvoiceId?: string;
    formalizedAt: Date;
    issueDate: Date;
    pdfUrl?: string;
    xmlUrl?: string;
    printUrl?: string;
    gibUuid?: string;
    gibEttn?: string;
    amounts: {
        total: number;
        subtotal: number;
        taxTotal: number;
        currency: CurrencyCode;
    };
    customer: {
        name: string;
        surname: string;
        email?: string;
        taxNumber?: string;
        companyName?: string;
    };
    fields?: Record<string, any>;
    timestamp: Date;
}
