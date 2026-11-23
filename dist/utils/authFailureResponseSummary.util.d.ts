import type { AuthFailureResponseSummary } from '../common/events/integration-auth-failure-exceeded-event';
/**
 * Hata yanitindan (axios `error.response` bicimi) pasiflestirme olayi icin ozet cikarir.
 * Hata firlatmaz; yanit yoksa undefined doner.
 */
export declare function summarizeAuthFailureResponse(response: {
    status?: number;
    headers?: unknown;
    data?: unknown;
} | undefined): AuthFailureResponseSummary | undefined;
