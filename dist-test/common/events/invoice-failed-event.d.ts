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
    category?: InvoiceCategory;
    erpPlatform?: string;
    erpId?: string;
    error: {
        code: string;
        message: string;
        details?: Record<string, any>;
        stackTrace?: string;
    };
    retryCount: number;
    maxRetries: number;
    willRetry: boolean;
    nextRetryAt?: Date;
    customer: {
        name: string;
        surname: string;
        email?: string;
        taxNumber?: string;
        companyName?: string;
    };
    failedAt: Date;
    timestamp: Date;
    fields?: Record<string, any>;
}
//# sourceMappingURL=invoice-failed-event.d.ts.map