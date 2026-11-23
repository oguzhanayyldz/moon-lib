"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeAuthFailureResponse = summarizeAuthFailureResponse;
const logSafety_util_1 = require("./logSafety.util");
const RESPONSE_BODY_SNIPPET_LIMIT = 200;
/**
 * Hata yanitindan (axios `error.response` bicimi) pasiflestirme olayi icin ozet cikarir.
 * Hata firlatmaz; yanit yoksa undefined doner.
 */
function summarizeAuthFailureResponse(response) {
    var _a;
    if (!response || typeof response.status !== 'number') {
        return undefined;
    }
    const summary = { status: response.status };
    try {
        const rawHeaders = response.headers;
        const headers = (rawHeaders && typeof rawHeaders.toJSON === 'function'
            ? rawHeaders.toJSON()
            : rawHeaders);
        const rateLimitHeaders = {};
        for (const [name, value] of Object.entries(headers || {})) {
            const lower = name.toLowerCase();
            if (value === undefined || value === null)
                continue;
            if (lower === 'retry-after') {
                summary.retryAfter = String(value);
            }
            else if (lower.startsWith('x-ratelimit-')) {
                rateLimitHeaders[lower] = String(value);
            }
        }
        if (Object.keys(rateLimitHeaders).length > 0) {
            summary.rateLimitHeaders = rateLimitHeaders;
        }
    }
    catch (_b) {
        // basliklar okunamazsa yalniz durum + govde
    }
    if (response.data !== undefined && response.data !== null && response.data !== '') {
        let text;
        try {
            text = typeof response.data === 'string' ? response.data : (_a = JSON.stringify(response.data)) !== null && _a !== void 0 ? _a : '';
        }
        catch (_c) {
            text = '';
            summary.bodySnippet = '[unserializable]';
        }
        if (text) {
            // Once maskele (kimlik bilgisi + kisisel veri, KVKK UC-2276) sonra kes: kesilmis JSON yapisal maskeden gecemez
            summary.bodySnippet = (0, logSafety_util_1.redactPersonalDataText)((0, logSafety_util_1.redactSensitiveText)(text)).slice(0, RESPONSE_BODY_SNIPPET_LIMIT);
        }
    }
    return summary;
}
