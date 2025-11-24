import { Subjects } from "./subjects";
import { InvoiceStatus, InvoiceType, InvoiceCategory } from "./types/invoice-status";
import { CurrencyCode } from "../types/currency-code";
import { ResourceName } from "../types/resourceName";
export interface InvoiceCreatedEvent {
    subject: Subjects.InvoiceCreated;
    data: {
        list: InvoiceCreated[];
        userId: string;
    };
}
export interface InvoiceCreated {
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
        docSerial?: string;
        date: Date;
        currency: CurrencyCode;
        uniqueCode?: string | null;
        fields?: Record<string, any>;
    };
    invoiceNumber?: string;
    status: InvoiceStatus;
    type: InvoiceType;
    category: InvoiceCategory;
    erpPlatform?: string;
    erpIntegrationId?: string;
    erpId?: string;
    erpInvoiceId?: string;
    erpStatus?: string;
    customer: {
        customerId?: string;
        customerUuid?: string;
        code?: string;
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
        fields?: Record<string, any>;
    };
    items: InvoiceItem[];
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
    formalizedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    pdfUrl?: string;
    xmlUrl?: string;
    printUrl?: string;
    gibUuid?: string;
    gibEttn?: string;
    description?: string;
    notes?: string;
    errorCode?: string;
    errorMessage?: string;
    errorDetails?: Record<string, any>;
    retryCount?: number;
    maxRetries?: number;
    willRetry?: boolean;
    nextRetryAt?: Date;
    fields?: Record<string, any>;
}
export interface InvoiceItem {
    id: string;
    uuid: string;
    version: number;
    productId?: string;
    combinationId?: string;
    packageProductId?: string;
    name: string;
    sku: string;
    barcode: string;
    code?: string;
    quantity: number;
    exQuantity?: number;
    unitPrice: number;
    unitPriceWithTax: number;
    taxRate: number;
    taxPrice: number;
    taxAmount: number;
    discountRate?: number;
    discountAmount?: number;
    commissionPrice?: number;
    commissionAmount?: number;
    totalAmount: number;
    totalWithoutTax: number;
    erpProductId?: string;
    erpPlatform?: string;
    fields?: Record<string, any>;
}
//# sourceMappingURL=invoice-created-event.d.ts.map