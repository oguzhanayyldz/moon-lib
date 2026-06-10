import { Subjects } from "./subjects";

/**
 * Auth hatasi esigi asildiginda yayinlanan event.
 * Integration servisi dinleyip UserIntegrationSettings.active=false yapar
 * ve kullaniciya in-app + email bildirim gonderir.
 *
 * Issue #566: Artik tek bir bozuk operasyon degil, BIRDEN FAZLA farkli operasyon
 * turu kendi auth esigini astiginda (gercek credential-geneli sorun) publish edilir.
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
        /**
         * Issue #566: Auth esigini asan farkli operasyon turleri (orn. FETCH_ORDERS, UPDATE_STOCK).
         * Opsiyonel — geriye uyumlu (eski publisher'lar gondermez).
         */
        failedOperations?: string[];
    };
}
