import { Subjects } from "./subjects";

/**
 * 5 ardisik 401/403 auth hatasi sonrasi yayinlanan event.
 * Integration servisi dinleyip UserIntegrationSettings.active=false yapar
 * ve kullaniciya in-app + email bildirim gonderir.
 */
export interface IntegrationAuthFailureExceededEvent {
    subject: Subjects.IntegrationAuthFailureExceeded;
    data: {
        userId: string;
        integrationId: string;
        integrationName: string;
        failureCount: number;
        lastErrorStatus: 401 | 403;
        lastErrorMessage?: string;
        timestamp: Date;
    };
}
