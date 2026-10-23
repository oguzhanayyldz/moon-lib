import { ResourceName } from '../common/types/resourceName';
import { OperationType } from '../enums/operation-type.enum';

/**
 * Entegrasyon istek logu saklama politikası (UC-979, UC-978 ölçümü).
 *
 * - Başarılı okumada yanıt gövdesi saklanmaz; yerine özet (`ResponseSummary`) yazılır.
 * - Hata ve yazma işlemlerinde tam istek + yanıt saklanır (64 KB sınırı UC-962'den).
 * - Saklama süresi sonuca göre `expireAt` ile: başarı 3 gün, hata 14 gün.
 * - Gelişmiş arama gövde regex'i yerine `searchKeys` kimlik listesinde tam eşleşmeyle yapılır.
 */

export const INTEGRATION_LOG_SUCCESS_RETENTION_SECONDS = 3 * 24 * 60 * 60;
export const INTEGRATION_LOG_FAILURE_RETENTION_SECONDS = 14 * 24 * 60 * 60;
/** Özette saklanan en fazla kimlik sayısı. */
export const INTEGRATION_LOG_SUMMARY_MAX_IDS = 200;
/** Bir kayıtta aranabilir en fazla kimlik sayısı (istek + yanıt + endpoint). */
export const INTEGRATION_LOG_SEARCH_KEYS_MAX = 300;

/** FETCH_* dışında kalan salt-okur işlemler. GET_BATCH_STATUS bilerek yok: toplu yazmanın sonucunu taşır. */
const READ_OPERATION_TYPES = new Set<string>([
    OperationType.READ,
    OperationType.GET_CATEGORIES,
    OperationType.GET_BRANDS,
    OperationType.GET_CATEGORY_ATTRIBUTES,
    OperationType.CHECK_STOCK,
    OperationType.CHECK_PRODUCT_STATUS,
    OperationType.CHECK_PACKAGEABLE_ITEMS,
    OperationType.HEALTH_CHECK
]);

/**
 * Okuma işlemi mi. Bilinmeyen tür, `OTHER` ve türsüz kayıt yazma sayılır: gövdesi saklanır (güvenli varsayılan).
 */
export function isReadOperation(operationType?: OperationType | string | null): boolean {
    if (!operationType) return false;
    return operationType.startsWith('FETCH_') || READ_OPERATION_TYPES.has(operationType);
}

export interface LogOutcomeInput {
    responseStatus?: number | null;
    /** Yorumlayıcının `success` değeri; yoksa undefined. */
    interpretedSuccess?: boolean;
    /** WAF/bot engeli sayfası tespit edildi mi. */
    blocked?: boolean;
    errorMessage?: string | null;
}

/**
 * Başarılı sonuç mu: 2xx, 207 değil, yorumlayıcı `success:false` demiyor, WAF engeli ve hata mesajı yok.
 * 409 da hata sayılır (idempotent başarı olsa bile gövdesi zaten yazma olarak saklanır).
 */
export function isSuccessfulLogOutcome(input: LogOutcomeInput): boolean {
    const status = input.responseStatus;
    if (typeof status !== 'number' || status < 200 || status >= 300 || status === 207) return false;
    if (input.interpretedSuccess === false) return false;
    if (input.blocked) return false;
    if (input.errorMessage) return false;
    return true;
}

/** Kaydın silineceği an: `base` + başarıda 3 gün, hatada 14 gün. */
export function computeLogExpireAt(base: Date, success: boolean): Date {
    const seconds = success ? INTEGRATION_LOG_SUCCESS_RETENTION_SECONDS : INTEGRATION_LOG_FAILURE_RETENTION_SECONDS;
    return new Date(base.getTime() + seconds * 1000);
}

/** Gövdenin UTF-8 bayt boyu (kırpma öncesi). Nesneler compact JSON olarak ölçülür. */
export function measureBodyBytes(body: unknown): number {
    if (body === undefined || body === null) return 0;
    if (typeof body === 'string') return Buffer.byteLength(body, 'utf8');
    try {
        return Buffer.byteLength(JSON.stringify(body) ?? '', 'utf8');
    } catch {
        return 0;
    }
}

export interface ResponseSummary {
    omitted: true;
    reason: 'successful-read';
    bytes: number;
    recordCount?: number;
    page?: number;
    size?: number;
    totalPages?: number;
    totalElements?: number;
    ids: string[];
    idsTruncated: boolean;
}

interface PageInfo {
    page?: number;
    size?: number;
    totalPages?: number;
    totalElements?: number;
}

interface ReadResponseExtractor {
    records(body: any): unknown[] | undefined;
    page(body: any): PageInfo;
}

const asArray = (value: unknown): unknown[] | undefined => (Array.isArray(value) ? value : undefined);
const asNumber = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/** Trendyol: `{ page, size, totalPages, totalElements, content: [...] }` (shipment-packages, claims, products). */
const trendyolExtractor: ReadResponseExtractor = {
    records: (body) => asArray(body?.content),
    page: (body) => ({
        page: asNumber(body?.page),
        size: asNumber(body?.size),
        totalPages: asNumber(body?.totalPages),
        totalElements: asNumber(body?.totalElements)
    })
};

/** N11 REST: `{ page, size, totalPages, pageCount, content: [...] }` — toplam kayıt yok. */
const n11Extractor: ReadResponseExtractor = {
    records: (body) => asArray(body?.content),
    page: (body) => ({
        page: asNumber(body?.page),
        size: asNumber(body?.size),
        totalPages: asNumber(body?.totalPages) ?? asNumber(body?.pageCount)
    })
};

/** İdefix: `{ items, pageCount }` ya da `{ data: { items, pageCount } }`; bazı uçlar `data: [...]`. */
const idefixExtractor: ReadResponseExtractor = {
    records: (body) =>
        asArray(body?.items) ?? asArray(body?.data?.items) ?? asArray(body?.data) ?? asArray(body?.content),
    page: (body) => ({
        page: asNumber(body?.page) ?? asNumber(body?.data?.page),
        size: asNumber(body?.limit) ?? asNumber(body?.data?.limit),
        totalPages: asNumber(body?.pageCount) ?? asNumber(body?.data?.pageCount),
        totalElements: asNumber(body?.totalCount) ?? asNumber(body?.data?.totalCount)
    })
};

/** Genel yedek: kök dizi ya da yaygın liste anahtarları. */
const genericExtractor: ReadResponseExtractor = {
    records: (body) =>
        asArray(body) ?? asArray(body?.content) ?? asArray(body?.items) ?? asArray(body?.data)
        ?? asArray(body?.data?.items) ?? asArray(body?.orders) ?? asArray(body?.products),
    page: (body) => ({
        page: asNumber(body?.page),
        size: asNumber(body?.size),
        totalPages: asNumber(body?.totalPages),
        totalElements: asNumber(body?.totalElements)
    })
};

const READ_RESPONSE_EXTRACTORS: Partial<Record<string, ReadResponseExtractor>> = {
    [ResourceName.Trendyol]: trendyolExtractor,
    [ResourceName.N11]: n11Extractor,
    [ResourceName.Idefix]: idefixExtractor
};

/** Kayıt kimliği sayılan alanlar: sipariş no, paket id, barkod. */
const RECORD_ID_FIELDS = ['orderNumber', 'id', 'shipmentPackageId', 'packageNumber', 'claimId', 'barcode'];
/** Kayıt içindeki satır dizileri; satırdan yalnız barkod alınır. */
const RECORD_LINE_FIELDS = ['lines', 'items', 'orderLines', 'packageItems'];

const toKey = (value: unknown): string | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed && trimmed.length <= 128 ? trimmed : undefined;
    }
    return undefined;
};

/** JSON metinse ayrıştırır; ayrıştırılamazsa undefined. */
function parseJsonBody(body: unknown): unknown {
    if (typeof body !== 'string') return body;
    const trimmed = body.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return undefined;
    try {
        return JSON.parse(trimmed);
    } catch {
        return undefined;
    }
}

/**
 * Gövde bir JSON nesnesi/dizisi mi (nesne ya da JSON metni). Boş gövde de yapısal sayılır: özetlenecek bir şey
 * kaybolmaz. 2xx okumada HTML/düz metin (WAF, bakım sayfası) gelirse gövde özetlenmez, tam saklanır.
 */
export function isStructuredResponseBody(body: unknown): boolean {
    if (body === undefined || body === null || body === '') return true;
    const parsed = parseJsonBody(body);
    return parsed !== null && typeof parsed === 'object';
}

class KeyCollector {
    readonly keys: string[] = [];
    private readonly seen = new Set<string>();
    truncated = false;

    constructor(private readonly max: number) { }

    add(value: unknown): boolean {
        const key = toKey(value);
        if (key === undefined || this.seen.has(key)) return true;
        if (this.keys.length >= this.max) {
            this.truncated = true;
            return false;
        }
        this.seen.add(key);
        this.keys.push(key);
        return true;
    }
}

/**
 * Başarılı okuma yanıtının özeti: kayıt sayısı, sayfa bilgisi ve ilk 200 kimlik.
 * Platformun çıkarıcısı liste bulamazsa genel yedeğe düşer.
 */
export function summarizeReadResponse(integrationName: string | undefined, body: unknown, bytes: number): ResponseSummary {
    const parsed = parseJsonBody(body);
    const platform = integrationName ? READ_RESPONSE_EXTRACTORS[integrationName] : undefined;
    let extractor = platform ?? genericExtractor;
    let records = parsed === undefined ? undefined : extractor.records(parsed);
    if (!records && platform) {
        extractor = genericExtractor;
        records = parsed === undefined ? undefined : extractor.records(parsed);
    }

    const ids = new KeyCollector(INTEGRATION_LOG_SUMMARY_MAX_IDS);
    if (records) {
        outer: for (const record of records) {
            if (!record || typeof record !== 'object') {
                if (!ids.add(record)) break;
                continue;
            }
            const item = record as Record<string, unknown>;
            for (const field of RECORD_ID_FIELDS) {
                if (!ids.add(item[field])) break outer;
            }
            for (const lineField of RECORD_LINE_FIELDS) {
                const lines = item[lineField];
                if (!Array.isArray(lines)) continue;
                for (const line of lines) {
                    if (line && typeof line === 'object' && !ids.add((line as Record<string, unknown>).barcode)) break outer;
                }
            }
        }
    }

    const page = parsed === undefined ? {} : extractor.page(parsed);
    const summary: ResponseSummary = {
        omitted: true,
        reason: 'successful-read',
        bytes,
        ids: ids.keys,
        idsTruncated: ids.truncated
    };
    if (records) summary.recordCount = records.length;
    (Object.keys(page) as Array<keyof PageInfo>).forEach((field) => {
        if (page[field] !== undefined) summary[field] = page[field];
    });
    return summary;
}

/** Gövdede kimlik sayılan alan adları (normalize: küçük harf, harf/rakam dışı yok). */
const SEARCH_KEY_FIELDS = new Set([
    'ordernumber', 'orderid', 'packageid', 'packagenumber', 'shipmentpackageid', 'shipmentid', 'claimid',
    'barcode', 'stockcode', 'merchantsku', 'sellersku', 'sku', 'productmainid', 'batchrequestid',
    'invoicenumber', 'cargotrackingnumber', 'trackingnumber'
]);
const MAX_WALK_NODES = 20000;
const MAX_WALK_DEPTH = 8;
// Endpoint yolundaki kimlik parçaları: en az 5 haneli sayı ya da UUID.
const PATH_ID_PATTERN = /^(?:\d{5,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

function collectBodyKeys(body: unknown, collector: KeyCollector): void {
    const parsed = parseJsonBody(body);
    if (parsed === undefined || parsed === null || typeof parsed !== 'object') return;
    let visited = 0;
    const walk = (value: unknown, depth: number): boolean => {
        if (++visited > MAX_WALK_NODES || depth > MAX_WALK_DEPTH) return true;
        if (Array.isArray(value)) {
            for (const item of value) if (!walk(item, depth + 1)) return false;
            return true;
        }
        if (!value || typeof value !== 'object') return true;
        for (const [name, item] of Object.entries(value as Record<string, unknown>)) {
            if (SEARCH_KEY_FIELDS.has(name.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
                if (Array.isArray(item)) {
                    for (const entry of item) if (!collector.add(entry)) return false;
                } else if (!collector.add(item)) {
                    return false;
                }
            }
            if (item && typeof item === 'object' && !walk(item, depth + 1)) return false;
        }
        return true;
    };
    walk(parsed, 0);
}

export interface SearchKeySources {
    endpoint?: string;
    requestBody?: unknown;
    responseBody?: unknown;
    summaryIds?: string[];
}

/**
 * Gelişmiş arama için kimlik listesi: özet kimlikleri, istek/yanıt gövdesindeki kimlik alanları
 * ve endpoint yolundaki sayısal/UUID parçalar. Ham (maskelenmemiş) gövdeden çıkarılır; kimlik
 * alanları kişisel veri değildir. En fazla `INTEGRATION_LOG_SEARCH_KEYS_MAX`.
 */
export function extractLogSearchKeys(sources: SearchKeySources): string[] {
    const collector = new KeyCollector(INTEGRATION_LOG_SEARCH_KEYS_MAX);
    if (sources.endpoint) {
        const path = sources.endpoint.split('?')[0];
        for (const segment of path.split('/')) {
            if (PATH_ID_PATTERN.test(segment)) collector.add(segment);
        }
    }
    for (const id of sources.summaryIds ?? []) {
        if (!collector.add(id)) break;
    }
    collectBodyKeys(sources.requestBody, collector);
    collectBodyKeys(sources.responseBody, collector);
    return collector.keys;
}

/** Gelişmiş arama değerinin `searchKeys` sorgusu: tam eşleşme, büyük/küçük harf varyantlarıyla. */
export function buildSearchKeysQuery(term: string): { searchKeys: { $in: string[] } } {
    const value = term.trim();
    return { searchKeys: { $in: Array.from(new Set([value, value.toUpperCase(), value.toLowerCase()])) } };
}
