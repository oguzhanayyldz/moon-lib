import { redactSensitiveText } from './logSafety.util';
import type { AuthFailureResponseSummary } from '../common/events/integration-auth-failure-exceeded-event';

const RESPONSE_BODY_SNIPPET_LIMIT = 200;

/**
 * Hata yanitindan (axios `error.response` bicimi) pasiflestirme olayi icin ozet cikarir.
 * Hata firlatmaz; yanit yoksa undefined doner.
 */
export function summarizeAuthFailureResponse(
    response: { status?: number; headers?: unknown; data?: unknown } | undefined
): AuthFailureResponseSummary | undefined {
    if (!response || typeof response.status !== 'number') {
        return undefined;
    }
    const summary: AuthFailureResponseSummary = { status: response.status };
    try {
        const rawHeaders = response.headers as any;
        const headers = (rawHeaders && typeof rawHeaders.toJSON === 'function'
            ? rawHeaders.toJSON()
            : rawHeaders) as Record<string, unknown> | undefined;
        const rateLimitHeaders: Record<string, string> = {};
        for (const [name, value] of Object.entries(headers || {})) {
            const lower = name.toLowerCase();
            if (value === undefined || value === null) continue;
            if (lower === 'retry-after') {
                summary.retryAfter = String(value);
            } else if (lower.startsWith('x-ratelimit-')) {
                rateLimitHeaders[lower] = String(value);
            }
        }
        if (Object.keys(rateLimitHeaders).length > 0) {
            summary.rateLimitHeaders = rateLimitHeaders;
        }
    } catch {
        // basliklar okunamazsa yalniz durum + govde
    }
    if (response.data !== undefined && response.data !== null && response.data !== '') {
        let text: string;
        try {
            text = typeof response.data === 'string' ? response.data : JSON.stringify(response.data) ?? '';
        } catch {
            text = '';
            summary.bodySnippet = '[unserializable]';
        }
        if (text) {
            // Once maskele sonra kes: kesilmis JSON yapisal maskeden gecemez
            summary.bodySnippet = redactSensitiveText(text).slice(0, RESPONSE_BODY_SNIPPET_LIMIT);
        }
    }
    return summary;
}
