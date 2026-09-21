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
 * matters: `{"email":{"$ne":null},"password":"<the user's password>"}` must be logged as
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
