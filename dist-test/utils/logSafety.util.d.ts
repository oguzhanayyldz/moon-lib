/** Error fields that may be written to logs. No other field (stack, cause, config, etc.) is carried over. */
export interface SafeConnectionError {
    name?: string;
    code?: string | number;
    message: string;
    input?: string;
    url?: string;
}
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
export declare function maskConnectionUriSecret(value: string | undefined): string | undefined;
/**
 * Masks connection addresses inside free text (such as an error message) using the `maskConnectionUriSecret` rules.
 *
 * An address region starts with a scheme or a word containing `@`. Because a password may contain whitespace,
 * the region extends to the end of the word holding the LAST `@` in the remaining text; if the text in between
 * cannot be parsed, it becomes `****` under the fail-closed rule. Text outside addresses is left unchanged.
 *
 * Known limit: in userinfo without a scheme, the part of a password before a whitespace is not treated as an address.
 */
export declare function maskConnectionUrisInText(text: string | undefined): string | undefined;
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
export declare function sanitizeConnectionError(error: unknown): SafeConnectionError;
/**
 * Turns an already-sanitized `SafeConnectionError` into a throwable `Error`, so a caller that rethrows or
 * logs it (e.g. via `util.inspect`) never sees the address. `name` and `code` are carried over; the raw
 * error is never attached as `cause`, because `util.inspect` prints `cause` and would undo the masking.
 */
export declare function toSafeError(safe: SafeConnectionError): Error;
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
export declare function maskSensitiveValues(value: unknown, depth?: number): unknown;
/** Marker written in place of a credential value. Kept equal to the marker IntegrationLog always used. */
export declare const REDACTED_FIELD_MASK = "***REDACTED***";
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
export declare function isSensitiveFieldName(name: string): boolean;
/**
 * Returns a copy of a JSON-shaped value in which every credential-named field is replaced by
 * `REDACTED_FIELD_MASK`, whatever its type (a whole `credentials` object is masked as one value).
 * Other strings go through `redactSensitiveText`, because a string may itself be a JSON document,
 * a SOAP envelope or a form body. Everything else is kept as it is.
 */
export declare function redactSensitiveFields<T>(value: T): T;
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
export declare function redactSensitiveText(text: string): string;
export declare function escapeRegExp(value: string): string;
/** Upper bound of the serialized meta, in characters. Longer output is cut and marked. */
export declare const MAX_LOG_META_LENGTH = 8192;
/** Written in place of meta that could not be serialized; the logger itself never throws. */
export declare const LOG_SERIALIZATION_ERROR = "{\"logSerializationError\":true}";
/** Error fields that may be written to logs. Headers, bodies and the request config are never carried over. */
export interface SafeLogError {
    name?: string;
    message: string;
    code?: string | number;
    status?: number;
    method?: string;
    url?: string;
    cause?: SafeLogError;
    stack?: string;
}
/** Whether a value is an `Error` or an axios error (checked on the raw value, before any `toJSON`). */
export declare function isLoggableError(value: unknown): boolean;
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
export declare function toSafeLogError(error: unknown, depth?: number): SafeLogError;
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
export declare function serializeLogMeta(meta: unknown, maxLength?: number): string;
/** Masks connection addresses, credential pairs and authorization tokens in an error message. */
export declare function maskErrorText(text: string): string;
/** Drops the query string, fragment and userinfo of a request URL. */
export declare function sanitizeRequestUrl(url: string): string;
//# sourceMappingURL=logSafety.util.d.ts.map