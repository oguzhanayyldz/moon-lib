"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOG_SERIALIZATION_ERROR = exports.MAX_LOG_META_LENGTH = exports.REDACTED_FIELD_MASK = void 0;
exports.maskConnectionUriSecret = maskConnectionUriSecret;
exports.maskConnectionUrisInText = maskConnectionUrisInText;
exports.sanitizeConnectionError = sanitizeConnectionError;
exports.toSafeError = toSafeError;
exports.maskSensitiveValues = maskSensitiveValues;
exports.isSensitiveFieldName = isSensitiveFieldName;
exports.redactSensitiveFields = redactSensitiveFields;
exports.redactSensitiveText = redactSensitiveText;
exports.escapeRegExp = escapeRegExp;
exports.isLoggableError = isLoggableError;
exports.toSafeLogError = toSafeLogError;
exports.serializeLogMeta = serializeLogMeta;
exports.maskErrorText = maskErrorText;
exports.sanitizeRequestUrl = sanitizeRequestUrl;
const MASK = '****';
// Prevents log-line forging (CR/LF injection etc.): stripped from segments carried into the output unchanged.
const CONTROL_CHAR_PATTERN = /[\x00-\x1F\x7F]/g;
const SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//;
// A comma followed by a new scheme starts a separate address (NATS: `<scheme>://a:4222,<scheme>://b:4222`).
// A Mongo multi-host comma is not followed by a scheme, so it stays inside the host list.
const URI_LIST_SEPARATOR = /(,\s*)(?=[A-Za-z][A-Za-z0-9+.-]*:\/\/)/;
const HOST_PATTERN = /^(?:[A-Za-z0-9._~%-]+|\[[A-Za-z0-9:.%]+\])(?::\d+)?$/;
const PATH_PATTERN = /^\/[A-Za-z0-9._~%/-]*$/;
const QUERY_KEY_PATTERN = /^[A-Za-z0-9_.-]+$/;
// Connection options known not to carry secrets (lowercase). Any query value not listed here is masked.
const SAFE_QUERY_KEYS = new Set([
    'appname', 'authmechanism', 'authsource', 'connecttimeoutms', 'directconnection', 'maxpoolsize',
    'readpreference', 'replicaset', 'retryreads', 'retrywrites', 'serverselectiontimeoutms',
    'sockettimeoutms', 'ssl', 'tls', 'w'
]);
// Start of an address in free text: a scheme (`redis://`) or the start of a word containing `@` (userinfo without scheme).
const URI_START_IN_TEXT = /[A-Za-z][A-Za-z0-9+.-]*:\/\/|[^\s@]*@/;
const WHITESPACE_PATTERN = /\s/;
const SAFE_ERROR_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const SAFE_ERROR_CODE_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
/**
 * Makes a connection address (MongoDB / Redis / NATS URI or a comma-separated address list) safe to log.
 *
 * The address is parsed structurally, following the WHATWG URL rule used by the Redis client: the userinfo
 * delimiter is the LAST `@`, the username delimiter is the FIRST `:`. Parsing is done by hand because the
 * WHATWG `URL` cannot parse Mongo multi-host addresses.
 *
 * Kept visible: scheme, host:port list, path (db name/number), known-safe query options and the username
 * in `name:password@` form.
 * Masked:
 * - password (`name:****@`)
 * - single-part userinfo (`****@`): it is a token in NATS and cannot be told apart from a username
 * - every query value not in the known-safe list (`key=****`)
 *
 * Fail-closed: if userinfo contains `/`, `?` or `#`, if the host list or path is not in the expected shape,
 * or if the address has a fragment (`#`), only the scheme is kept and the rest becomes `****`. A valueless
 * or malformed query part not in the list becomes `****` entirely. If userinfo contains whitespace or the
 * username contains an unescaped `@`, userinfo becomes `****@` entirely (extra rule over the products version).
 *
 * Log-line-forging prevention: control characters (`\x00`-`\x1F`, `\x7F` — CR/LF injection, terminal escape
 * sequences, etc.) are stripped from the two segments carried into the output unchanged: the username in
 * `name:****@` and a known-safe query value. They are not credentials, but left in place they could inject
 * a fake log line or an escape sequence. The whitespace/`@` extra rule above already masks a username
 * carrying CR/LF/TAB entirely, so this mainly guards other control characters (NUL, ESC) in the username and
 * all of them in a safe query value.
 *
 * All other rules match products `maskConnectionUriSecret` (PR #702).
 */
function maskConnectionUriSecret(value) {
    if (!value) {
        return value;
    }
    return maskUriList(value);
}
/**
 * Masks connection addresses inside free text (such as an error message) using the `maskConnectionUriSecret` rules.
 *
 * An address region starts with a scheme or a word containing `@`. Because a password may contain whitespace,
 * the region extends to the end of the word holding the LAST `@` in the remaining text; if the text in between
 * cannot be parsed, it becomes `****` under the fail-closed rule. Text outside addresses is left unchanged.
 *
 * Known limit: in userinfo without a scheme, the part of a password before a whitespace is not treated as an address.
 */
function maskConnectionUrisInText(text) {
    if (!text) {
        return text;
    }
    let result = '';
    let rest = text;
    let start = rest.search(URI_START_IN_TEXT);
    while (start !== -1) {
        const anchor = Math.max(start, rest.lastIndexOf('@'));
        const whitespaceIndex = rest.slice(anchor).search(WHITESPACE_PATTERN);
        const end = whitespaceIndex === -1 ? rest.length : anchor + whitespaceIndex;
        result += rest.slice(0, start) + maskUriList(rest.slice(start, end));
        rest = rest.slice(end);
        start = rest.search(URI_START_IN_TEXT);
    }
    return result + rest;
}
/**
 * Converts a connection error into a log-safe object made only of safe fields.
 *
 * - `message`: addresses inside it are masked (`maskConnectionUrisInText`)
 * - `input`, `url`: treated as addresses and masked (an `ERR_INVALID_URL` error carries the address in `input`)
 * - `name`, `code`: carried over only when they match the expected shape
 *
 * Other fields of the raw error (stack, cause, driver configuration) are deliberately dropped. If a non-error
 * value was thrown, it is converted to text and masked.
 */
function sanitizeConnectionError(error) {
    if (typeof error !== 'object' || error === null) {
        return { message: maskUriTextOrEmpty(String(error)) };
    }
    const source = error;
    const safeError = {
        message: typeof source.message === 'string' ? maskUriTextOrEmpty(source.message) : ''
    };
    if (typeof source.name === 'string' && SAFE_ERROR_NAME_PATTERN.test(source.name)) {
        safeError.name = source.name;
    }
    if (typeof source.code === 'number' || (typeof source.code === 'string' && SAFE_ERROR_CODE_PATTERN.test(source.code))) {
        safeError.code = source.code;
    }
    if (typeof source.input === 'string') {
        safeError.input = maskConnectionUriSecret(source.input);
    }
    if (typeof source.url === 'string') {
        safeError.url = maskConnectionUriSecret(source.url);
    }
    return safeError;
}
/**
 * Turns an already-sanitized `SafeConnectionError` into a throwable `Error`, so a caller that rethrows or
 * logs it (e.g. via `util.inspect`) never sees the address. `name` and `code` are carried over; the raw
 * error is never attached as `cause`, because `util.inspect` prints `cause` and would undo the masking.
 */
function toSafeError(safe) {
    const error = new Error(safe.message);
    if (safe.name) {
        error.name = safe.name;
    }
    if (safe.code !== undefined) {
        error.code = safe.code;
    }
    if (safe.input !== undefined) {
        error.input = safe.input;
    }
    if (safe.url !== undefined) {
        error.url = safe.url;
    }
    return error;
}
function maskUriTextOrEmpty(text) {
    var _a;
    return (_a = maskConnectionUrisInText(text)) !== null && _a !== void 0 ? _a : '';
}
function maskUriList(value) {
    return value
        .split(URI_LIST_SEPARATOR)
        .map((part, index) => (index % 2 === 1 ? part : maskSingleUri(part)))
        .join('');
}
function maskSingleUri(uri) {
    var _a, _b;
    const scheme = (_b = (_a = SCHEME_PATTERN.exec(uri)) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : '';
    const rest = uri.slice(scheme.length);
    const atIndex = rest.lastIndexOf('@');
    const userInfo = atIndex === -1 ? undefined : rest.slice(0, atIndex);
    // `/?#` cannot be told apart as part of the password or as path/query.
    if (userInfo !== undefined && /[/?#]/.test(userInfo)) {
        return scheme + MASK;
    }
    const address = rest.slice(atIndex + 1);
    const tailIndex = address.search(/[/?#]/);
    const hosts = tailIndex === -1 ? address : address.slice(0, tailIndex);
    const tail = maskTail(tailIndex === -1 ? '' : address.slice(tailIndex));
    if (tail === undefined || !hosts.split(',').every((host) => HOST_PATTERN.test(host))) {
        return scheme + MASK;
    }
    return scheme + maskUserInfo(userInfo) + hosts + tail;
}
function maskUserInfo(userInfo) {
    if (userInfo === undefined) {
        return '';
    }
    const colonIndex = userInfo.indexOf(':');
    if (colonIndex === -1) {
        return userInfo ? `${MASK}@` : '@';
    }
    const username = userInfo.slice(0, colonIndex);
    // With whitespace or an unescaped `@` in the username, the username cannot be split off safely (in free
    // text several addresses may have merged into one region): userinfo is masked entirely.
    if (username.includes('@') || WHITESPACE_PATTERN.test(userInfo)) {
        return `${MASK}@`;
    }
    return `${username.replace(CONTROL_CHAR_PATTERN, '')}:${MASK}@`;
}
/** Path + query. Returns undefined when it cannot be parsed (fail-closed). */
function maskTail(tail) {
    if (tail.includes('#')) {
        return undefined;
    }
    const queryIndex = tail.indexOf('?');
    const path = queryIndex === -1 ? tail : tail.slice(0, queryIndex);
    if (path && !PATH_PATTERN.test(path)) {
        return undefined;
    }
    if (queryIndex === -1) {
        return path;
    }
    const query = tail.slice(queryIndex + 1).split('&').map(maskQueryParam).join('&');
    return `${path}?${query}`;
}
function maskQueryParam(param) {
    const equalsIndex = param.indexOf('=');
    const key = equalsIndex === -1 ? param : param.slice(0, equalsIndex);
    if (!param || SAFE_QUERY_KEYS.has(key.toLowerCase())) {
        return param.replace(CONTROL_CHAR_PATTERN, '');
    }
    // A valueless part or a malformed key may be the secret itself.
    return equalsIndex === -1 || !QUERY_KEY_PATTERN.test(key) ? MASK : `${key}=${MASK}`;
}
// --- Request shape redaction -------------------------------------------------------------------
// Limits for `maskSensitiveValues`. They bound both the log line's size and the work done on a
// hostile input: the value being redacted is attacker-controlled (a rejected request body).
const MAX_SHAPE_DEPTH = 4;
const MAX_SHAPE_KEYS = 20;
const MAX_SHAPE_ITEMS = 5;
const MAX_SHAPE_KEY_LENGTH = 64;
/**
 * Turns a request-shaped value (body, params, query) into something safe to log: the SHAPE is kept,
 * every leaf VALUE becomes `****`.
 *
 * It exists for the NoSQL-injection path, where the rejected input has to be described in a log line
 * without carrying what it contained. A rejected `/api/users/signin` body is exactly the case that
 * matters: `{"email":{"$ne":null},"password":"<value>"}` (the user's password) must be logged as
 * `{"email":{"$ne":"****"},"password":"****"}` — the operator and the field stay readable, the
 * credential does not survive.
 *
 * Fail-closed on values: EVERY leaf (string, number, boolean, null, undefined, function, symbol,
 * Date, Buffer, …) becomes `****`. No value is ever considered harmless, because what is harmless
 * depends on the route, not on the type. The diagnostic value comes from the keys.
 *
 * Kept visible: object keys and array structure — this is what names the operator (`$ne`) and the
 * field it sits on. Keys come from the attacker too, so they are stripped of control characters
 * (log-line forging, the same rule as `maskConnectionUriSecret`) and cut to `MAX_SHAPE_KEY_LENGTH`.
 *
 * Bounded: at most `MAX_SHAPE_KEYS` keys per object and `MAX_SHAPE_ITEMS` items per array (the rest
 * is summarised as `…(+N)`), at most `MAX_SHAPE_DEPTH` levels deep (deeper levels become `…`). A
 * 10 MB body therefore cannot turn into a 10 MB log line.
 */
function maskSensitiveValues(value, depth = 0) {
    if (typeof value !== 'object' || value === null) {
        return MASK;
    }
    if (depth >= MAX_SHAPE_DEPTH) {
        return '…';
    }
    if (Array.isArray(value)) {
        const items = value.slice(0, MAX_SHAPE_ITEMS).map((item) => maskSensitiveValues(item, depth + 1));
        if (value.length > MAX_SHAPE_ITEMS) {
            items.push(`…(+${value.length - MAX_SHAPE_ITEMS})`);
        }
        return items;
    }
    const entries = Object.entries(value);
    const masked = {};
    for (const [key, item] of entries.slice(0, MAX_SHAPE_KEYS)) {
        masked[maskShapeKey(key)] = maskSensitiveValues(item, depth + 1);
    }
    if (entries.length > MAX_SHAPE_KEYS) {
        masked['…'] = `+${entries.length - MAX_SHAPE_KEYS}`;
    }
    return masked;
}
function maskShapeKey(key) {
    return key.replace(CONTROL_CHAR_PATTERN, '').slice(0, MAX_SHAPE_KEY_LENGTH);
}
// --- Credential field redaction ----------------------------------------------------------------
// Used by IntegrationRequestLogService: an integration log keeps the platform payload readable for
// debugging, so only the values of credential-named fields are replaced. `maskSensitiveValues`
// above masks every leaf and would make those logs useless, which is why this is a separate rule.
/** Marker written in place of a credential value. Kept equal to the marker IntegrationLog always used. */
exports.REDACTED_FIELD_MASK = '***REDACTED***';
const TURKISH_TO_ASCII = {
    ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i', ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u'
};
// Matched anywhere inside the normalized name: `ApiKey`, `x-ibm-client-secret`, `restrictedDataToken`, `WebServisSifre`.
const SENSITIVE_NAME_PARTS = [
    'password', 'passwd', 'passphrase', 'parola', 'sifre', 'secret', 'token', 'key', 'authorization',
    'credential', 'cookie', 'bearer', 'uyekodu', 'yetkikodu'
];
// Matched only as the whole normalized name: too short or too common to be searched inside other names.
// The login names are half of a username/password pair (Aras, Yurtiçi, Paraşüt, Mikro, Sürat).
const SENSITIVE_NAMES = new Set([
    'pass', 'pwd', 'auth', 'username', 'wsusername', 'kullaniciadi', 'kullanicikodu', 'firmakodu', 'customercode'
]);
// Non-secret fields that contain a part above, measured on the integrations' payloads: product SEO
// text (`metaKeywords`, `SeoKeywords`), the cargo tracking key, pagination cursors (Trendyol
// `nextPageToken`, Amazon `NextToken`) and the Shopify `sortKey` enum. They are cut out of the name
// before the part check, so `keywordSecret` is still masked for its `secret`.
const NON_SENSITIVE_NAME_PARTS = ['keyword', 'cargokey', 'sortkey', 'nexttoken', 'nextpagetoken'];
const NON_ALPHANUMERIC_PATTERN = /[^a-z0-9]/g;
// XML start tag, optionally namespace-prefixed and with attributes: `<tem:UyeKodu xsi:type="x">`.
const XML_START_TAG_PATTERN = /<((?:[A-Za-z_][\w.-]*:)?([A-Za-z_][\w.-]*))(\s[^<>]*)?>/;
// `"name": value` pair in text that is not parseable JSON (a JSON fragment inside an error message).
// A pair never starts at an escaped quote (`\"`): a JSON name is never opened by one, and without the
// lookbehind every `\"` of an escaped or double-encoded text started a match that scanned on to the
// next real quote — quadratic time (a 1 MB text blocked the event loop for minutes). With it, every
// quote that starts a match also ends every scan that reaches it, so the scans never overlap: linear.
const JSON_PAIR_PATTERN = /(?<!\\)"((?:[^"\\]|\\.)*)"(\s*:\s*)("(?:[^"\\]|\\.)*"|-?\d[\d.eE+-]*|true|false|null)/g;
// `name=` of a form-urlencoded body or query string. Only a credential's value is consumed, so a
// value is still scanned for the next name (`scope=read,client_secret=…`, `redirect=…?token=…`).
const FORM_NAME_PATTERN = /(^|[?&;,\s"'])([^\s=&?;,"'<>]+)=/;
// A quoted value — `name="…"`, `name='…'`, an XML attribute, or `name=\"…\"` inside a JSON string —
// runs to the same quote sequence, whitespace and `&` included.
const FORM_VALUE_QUOTE_PATTERN = /^\\*["']/;
// An unquoted value stops at `&`, at angle brackets, or at a quote that closes the text around it
// (followed by a JSON/XML delimiter or the end), so an XML or JSON text around it stays intact.
// Whitespace and line breaks belong to the value (a passphrase, a PEM key): fail-closed.
const FORM_VALUE_END_PATTERN = /[&<>]|["'](?=[\s,;:)}\]>/]|$)/;
/**
 * Whether a field, header, XML element or form key name holds a credential.
 *
 * The name is normalized first — Turkish letters folded to ASCII, lower-cased, everything except
 * letters and digits removed — so `Api-Key`, `API_KEY`, `apiKey`, `ŞİFRE` and `x-api-key` all compare
 * the same way. It is sensitive when the normalized name contains a `SENSITIVE_NAME_PARTS` entry
 * (after the known non-secret parts are cut out) or equals a `SENSITIVE_NAMES` entry.
 *
 * Fail-closed on purpose: an unknown name that merely contains `key` or `token` is masked. A
 * false positive costs a readable log value; a false negative writes a credential to IntegrationLog.
 */
function isSensitiveFieldName(name) {
    const normalized = normalizeFieldName(name);
    if (SENSITIVE_NAMES.has(normalized)) {
        return true;
    }
    const withoutKnownSafeParts = NON_SENSITIVE_NAME_PARTS.reduce((rest, part) => rest.split(part).join(''), normalized);
    return SENSITIVE_NAME_PARTS.some((part) => withoutKnownSafeParts.includes(part));
}
/**
 * Returns a copy of a JSON-shaped value in which every credential-named field is replaced by
 * `REDACTED_FIELD_MASK`, whatever its type (a whole `credentials` object is masked as one value).
 * Other strings go through `redactSensitiveText`, because a string may itself be a JSON document,
 * a SOAP envelope or a form body. Everything else is kept as it is.
 */
function redactSensitiveFields(value) {
    if (typeof value === 'string') {
        return redactSensitiveText(value);
    }
    if (Array.isArray(value)) {
        return value.map((item) => redactSensitiveFields(item));
    }
    if (typeof value !== 'object' || value === null) {
        return value;
    }
    // fromEntries defines own properties, so a `__proto__` key coming from the payload stays a plain field.
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
        key,
        isSensitiveFieldName(key) ? exports.REDACTED_FIELD_MASK : redactSensitiveFields(item)
    ]));
}
/**
 * Masks credential values inside a text body.
 *
 * - A text that parses as a JSON object or array is redacted structurally and serialized again; it
 *   is returned unchanged when it holds no credential field, so its original formatting stays.
 * - Otherwise three shapes are masked in place: XML elements (namespace prefix, attributes, CDATA
 *   and multi-line values included), `"name": value` pairs and `name=value` pairs — form bodies,
 *   query strings and XML attributes (`<auth key="…"/>`); a quoted value is masked up to its closing
 *   quote, an unquoted one up to the next `&`, angle bracket or closing quote, whitespace included.
 *
 * Fail-closed: a credential-named XML element without a closing tag, and a quoted credential value
 * without a closing quote, are masked up to the end of the text.
 * Every rule runs in linear time: the text may come from a tenant-controlled site.
 * Known limit: credentials in escaped JSON pairs (`{\"Sifre\":…}` inside a string that is not itself
 * JSON) and in attributes with whitespace around `=` (`key = "…"`) are not recognized.
 */
function redactSensitiveText(text) {
    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            const redacted = JSON.stringify(redactSensitiveFields(parsed));
            return redacted === JSON.stringify(parsed) ? text : redacted;
        }
        catch (_a) {
            // Not JSON after all (or a JSON fragment): fall through to the text rules.
        }
    }
    return redactFormPairs(redactJsonPairs(redactXmlElements(text)));
}
function normalizeFieldName(name) {
    return name
        .replace(/[çÇğĞıİöÖşŞüÜ]/g, (letter) => TURKISH_TO_ASCII[letter])
        .toLowerCase()
        .replace(NON_ALPHANUMERIC_PATTERN, '');
}
function redactXmlElements(text) {
    const startTag = new RegExp(XML_START_TAG_PATTERN.source, 'g');
    let result = '';
    let copiedUpTo = 0;
    let match;
    while ((match = startTag.exec(text)) !== null) {
        const [tag, qualifiedName, localName, attributes] = match;
        if ((attributes !== null && attributes !== void 0 ? attributes : '').endsWith('/') || !isSensitiveFieldName(localName)) {
            continue;
        }
        const contentStart = match.index + tag.length;
        const closingTag = new RegExp(`</${escapeRegExp(qualifiedName)}\\s*>`, 'i');
        const closing = closingTag.exec(text.slice(contentStart));
        const contentEnd = closing ? contentStart + closing.index : text.length;
        result += text.slice(copiedUpTo, contentStart) + exports.REDACTED_FIELD_MASK;
        copiedUpTo = contentEnd;
        startTag.lastIndex = closing ? contentEnd + closing[0].length : text.length;
    }
    return result + text.slice(copiedUpTo);
}
function redactJsonPairs(text) {
    return text.replace(JSON_PAIR_PATTERN, (pair, name, separator) => isSensitiveFieldName(name) ? `"${name}"${separator}"${exports.REDACTED_FIELD_MASK}"` : pair);
}
function redactFormPairs(text) {
    var _a;
    const formName = new RegExp(FORM_NAME_PATTERN.source, 'g');
    let result = '';
    let copiedUpTo = 0;
    let match;
    while ((match = formName.exec(text)) !== null) {
        if (!isSensitiveFieldName(match[2])) {
            continue;
        }
        const valueStart = match.index + match[0].length;
        const value = text.slice(valueStart);
        const quote = (_a = FORM_VALUE_QUOTE_PATTERN.exec(value)) === null || _a === void 0 ? void 0 : _a[0];
        let valueLength;
        if (quote) {
            // Fail-closed: a quoted value that is never closed is masked up to the end of the text.
            const closingIndex = value.indexOf(quote, quote.length);
            valueLength = closingIndex === -1 ? value.length : closingIndex + quote.length;
            result += text.slice(copiedUpTo, valueStart) + quote + exports.REDACTED_FIELD_MASK + (closingIndex === -1 ? '' : quote);
        }
        else {
            const valueEnd = value.search(FORM_VALUE_END_PATTERN);
            valueLength = valueEnd === -1 ? value.length : valueEnd;
            result += text.slice(copiedUpTo, valueStart) + exports.REDACTED_FIELD_MASK;
        }
        copiedUpTo = valueStart + valueLength;
        formName.lastIndex = copiedUpTo;
    }
    return result + text.slice(copiedUpTo);
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// --- Log meta serialization --------------------------------------------------------------------
// Used by the shared winston logger. `JSON.stringify(meta)` threw on circular errors (an AxiosError
// references itself through config/request/response), which replaced the caller's error with
// "Converting circular structure to JSON"; and `AxiosError.toJSON()` wrote the request config —
// headers included — into the log line. An error is therefore reduced to a whitelist of fields.
/** Upper bound of the serialized meta, in characters. Longer output is cut and marked. */
exports.MAX_LOG_META_LENGTH = 8192;
/** Written in place of meta that could not be serialized; the logger itself never throws. */
exports.LOG_SERIALIZATION_ERROR = '{"logSerializationError":true}';
const MAX_ERROR_CAUSE_DEPTH = 3;
const SAFE_HTTP_METHOD_PATTERN = /^[A-Za-z]{1,16}$/;
const STACK_FRAME_PATTERN = /^\s+at /;
const URL_USERINFO_PATTERN = /^([A-Za-z][A-Za-z0-9+.-]*:\/\/)[^/]*@/;
// `Bearer <token>` / `Basic <base64>` in free text (a header echoed into an error message). Fail-closed:
// the word after a plain-English "basic" is masked too, because a base64 value cannot be told apart from it.
const AUTH_SCHEME_TOKEN_PATTERN = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi;
/** Whether a value is an `Error` or an axios error (checked on the raw value, before any `toJSON`). */
function isLoggableError(value) {
    if (value instanceof Error) {
        return true;
    }
    return typeof value === 'object' && value !== null && value.isAxiosError === true;
}
/**
 * Reduces an error (plain `Error`, `AxiosError`, driver error, or a non-error thrown value) to fields
 * that are safe to log:
 *
 * - `message`: connection addresses, credential pairs and `Bearer`/`Basic` tokens inside it are masked
 * - `name`, `code`: carried over only when they match the expected shape
 * - `status`: the HTTP status (`response.status`, `status` or `statusCode`)
 * - `method`, `url`: from the axios request config; the URL loses its query string, fragment and userinfo
 *   (`?api_key=…` must not reach the log)
 * - `cause`: reduced the same way, at most `MAX_ERROR_CAUSE_DEPTH` levels deep (a cause may point back)
 * - `stack`: only when `LOG_STACK` is not `0`/`false`; its first line is rebuilt from the masked message
 *   and only the `at …` frames are kept, since the raw first line repeats the unmasked message
 *
 * Everything else — headers, request/response bodies, `config.data`, sockets — is deliberately dropped.
 */
function toSafeLogError(error, depth = 0) {
    var _a;
    if (typeof error !== 'object' || error === null) {
        return { message: maskErrorText(String(error)) };
    }
    const source = error;
    const safeError = {
        message: typeof source.message === 'string' ? maskErrorText(source.message) : ''
    };
    if (typeof source.name === 'string' && SAFE_ERROR_NAME_PATTERN.test(source.name)) {
        safeError.name = source.name;
    }
    if (typeof source.code === 'number' || (typeof source.code === 'string' && SAFE_ERROR_CODE_PATTERN.test(source.code))) {
        safeError.code = source.code;
    }
    const response = asRecord(source.response);
    const status = [response === null || response === void 0 ? void 0 : response.status, source.status, source.statusCode].find((value) => typeof value === 'number');
    if (status !== undefined) {
        safeError.status = status;
    }
    const config = asRecord(source.config);
    if (config) {
        if (typeof config.method === 'string' && SAFE_HTTP_METHOD_PATTERN.test(config.method)) {
            safeError.method = config.method.toUpperCase();
        }
        if (typeof config.url === 'string') {
            safeError.url = sanitizeRequestUrl(joinRequestUrl(config.baseURL, config.url));
        }
    }
    if (source.cause !== undefined && source.cause !== null && depth < MAX_ERROR_CAUSE_DEPTH) {
        safeError.cause = toSafeLogError(source.cause, depth + 1);
    }
    if (isStackLoggingEnabled() && typeof source.stack === 'string') {
        const frames = source.stack.split('\n').filter((line) => STACK_FRAME_PATTERN.test(line));
        safeError.stack = [`${(_a = safeError.name) !== null && _a !== void 0 ? _a : 'Error'}: ${safeError.message}`, ...frames].join('\n');
    }
    return safeError;
}
/**
 * Serializes log meta to JSON without ever throwing.
 *
 * - Errors are caught on the RAW value (`this[key]`), before `toJSON` output replaces them: the value
 *   the replacer receives for an `AxiosError` is already `toJSON()`'s copy of the request config.
 *   They are written as `toSafeLogError` output.
 * - Cycles become `"[Circular]"`. Detection uses the stack of ancestors of the current value, not a
 *   `WeakSet` of every visited value: the same object referenced twice without a cycle is written twice.
 * - `bigint` is written as a string, a `Buffer` as its length only.
 * - Output longer than `maxLength` is cut and marked with the number of characters dropped.
 * - Anything that still throws (a throwing getter or `toJSON`) yields `LOG_SERIALIZATION_ERROR`.
 */
function serializeLogMeta(meta, maxLength = exports.MAX_LOG_META_LENGTH) {
    let json;
    try {
        const ancestors = [];
        json = JSON.stringify(meta, function (key, value) {
            const raw = this[key];
            let result = value;
            if (isLoggableError(raw)) {
                result = toSafeLogError(raw);
            }
            else if (typeof value === 'bigint') {
                return value.toString();
            }
            else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(raw)) {
                return `[Buffer ${raw.length} bytes]`;
            }
            if (typeof result === 'object' && result !== null) {
                while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) {
                    ancestors.pop();
                }
                if (ancestors.includes(result)) {
                    return '[Circular]';
                }
                ancestors.push(result);
            }
            return result;
        });
    }
    catch (_a) {
        return exports.LOG_SERIALIZATION_ERROR;
    }
    if (json === undefined) {
        return '';
    }
    return json.length > maxLength ? `${json.slice(0, maxLength)}…[truncated ${json.length - maxLength} chars]` : json;
}
/** Masks connection addresses, credential pairs and authorization tokens in an error message. */
function maskErrorText(text) {
    return redactSensitiveText(maskUriTextOrEmpty(text)).replace(AUTH_SCHEME_TOKEN_PATTERN, `$1 ${MASK}`);
}
/** Drops the query string, fragment and userinfo of a request URL. */
function sanitizeRequestUrl(url) {
    return url.split(/[?#]/, 1)[0].replace(URL_USERINFO_PATTERN, `$1${MASK}@`).replace(CONTROL_CHAR_PATTERN, '');
}
function joinRequestUrl(baseURL, url) {
    if (SCHEME_PATTERN.test(url) || typeof baseURL !== 'string' || !baseURL) {
        return url;
    }
    return `${baseURL.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
}
function asRecord(value) {
    return typeof value === 'object' && value !== null ? value : undefined;
}
function isStackLoggingEnabled() {
    var _a;
    const setting = ((_a = process.env.LOG_STACK) !== null && _a !== void 0 ? _a : '').trim().toLowerCase();
    return setting !== '0' && setting !== 'false';
}
//# sourceMappingURL=logSafety.util.js.map