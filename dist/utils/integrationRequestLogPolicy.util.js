"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INTEGRATION_LOG_SEARCH_KEYS_MAX = exports.INTEGRATION_LOG_SUMMARY_MAX_IDS = exports.INTEGRATION_LOG_FAILURE_RETENTION_SECONDS = exports.INTEGRATION_LOG_SUCCESS_RETENTION_SECONDS = void 0;
exports.isReadOperation = isReadOperation;
exports.isSuccessfulLogOutcome = isSuccessfulLogOutcome;
exports.computeLogExpireAt = computeLogExpireAt;
exports.measureBodyBytes = measureBodyBytes;
exports.isStructuredResponseBody = isStructuredResponseBody;
exports.summarizeReadResponse = summarizeReadResponse;
exports.extractLogSearchKeys = extractLogSearchKeys;
exports.buildSearchKeysQuery = buildSearchKeysQuery;
const resourceName_1 = require("../common/types/resourceName");
const operation_type_enum_1 = require("../enums/operation-type.enum");
/**
 * Entegrasyon istek logu saklama politikası (UC-979, UC-978 ölçümü).
 *
 * - Başarılı okumada yanıt gövdesi saklanmaz; yerine özet (`ResponseSummary`) yazılır.
 * - Hata ve yazma işlemlerinde tam istek + yanıt saklanır (64 KB sınırı UC-962'den).
 * - Saklama süresi sonuca göre `expireAt` ile: başarı 3 gün, hata 14 gün.
 * - Gelişmiş arama gövde regex'i yerine `searchKeys` kimlik listesinde tam eşleşmeyle yapılır.
 */
exports.INTEGRATION_LOG_SUCCESS_RETENTION_SECONDS = 3 * 24 * 60 * 60;
exports.INTEGRATION_LOG_FAILURE_RETENTION_SECONDS = 14 * 24 * 60 * 60;
/** Özette saklanan en fazla kimlik sayısı. */
exports.INTEGRATION_LOG_SUMMARY_MAX_IDS = 200;
/** Bir kayıtta aranabilir en fazla kimlik sayısı (istek + yanıt + endpoint). */
exports.INTEGRATION_LOG_SEARCH_KEYS_MAX = 300;
/** FETCH_* dışında kalan salt-okur işlemler. GET_BATCH_STATUS bilerek yok: toplu yazmanın sonucunu taşır. */
const READ_OPERATION_TYPES = new Set([
    operation_type_enum_1.OperationType.READ,
    operation_type_enum_1.OperationType.GET_CATEGORIES,
    operation_type_enum_1.OperationType.GET_BRANDS,
    operation_type_enum_1.OperationType.GET_CATEGORY_ATTRIBUTES,
    operation_type_enum_1.OperationType.CHECK_STOCK,
    operation_type_enum_1.OperationType.CHECK_PRODUCT_STATUS,
    operation_type_enum_1.OperationType.CHECK_PACKAGEABLE_ITEMS,
    operation_type_enum_1.OperationType.HEALTH_CHECK
]);
/**
 * Okuma işlemi mi. Bilinmeyen tür, `OTHER` ve türsüz kayıt yazma sayılır: gövdesi saklanır (güvenli varsayılan).
 */
function isReadOperation(operationType) {
    if (!operationType)
        return false;
    return operationType.startsWith('FETCH_') || READ_OPERATION_TYPES.has(operationType);
}
/**
 * Başarılı sonuç mu: 2xx, 207 değil, yorumlayıcı `success:false` demiyor, WAF engeli ve hata mesajı yok.
 * 409 da hata sayılır (idempotent başarı olsa bile gövdesi zaten yazma olarak saklanır).
 */
function isSuccessfulLogOutcome(input) {
    const status = input.responseStatus;
    if (typeof status !== 'number' || status < 200 || status >= 300 || status === 207)
        return false;
    if (input.interpretedSuccess === false)
        return false;
    if (input.blocked)
        return false;
    if (input.errorMessage)
        return false;
    return true;
}
/** Kaydın silineceği an: `base` + başarıda 3 gün, hatada 14 gün. */
function computeLogExpireAt(base, success) {
    const seconds = success ? exports.INTEGRATION_LOG_SUCCESS_RETENTION_SECONDS : exports.INTEGRATION_LOG_FAILURE_RETENTION_SECONDS;
    return new Date(base.getTime() + seconds * 1000);
}
/** Gövdenin UTF-8 bayt boyu (kırpma öncesi). Nesneler compact JSON olarak ölçülür. */
function measureBodyBytes(body) {
    var _a;
    if (body === undefined || body === null)
        return 0;
    if (typeof body === 'string')
        return Buffer.byteLength(body, 'utf8');
    try {
        return Buffer.byteLength((_a = JSON.stringify(body)) !== null && _a !== void 0 ? _a : '', 'utf8');
    }
    catch (_b) {
        return 0;
    }
}
const asArray = (value) => (Array.isArray(value) ? value : undefined);
const asNumber = (value) => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
/** Trendyol: `{ page, size, totalPages, totalElements, content: [...] }` (shipment-packages, claims, products). */
const trendyolExtractor = {
    records: (body) => asArray(body === null || body === void 0 ? void 0 : body.content),
    page: (body) => ({
        page: asNumber(body === null || body === void 0 ? void 0 : body.page),
        size: asNumber(body === null || body === void 0 ? void 0 : body.size),
        totalPages: asNumber(body === null || body === void 0 ? void 0 : body.totalPages),
        totalElements: asNumber(body === null || body === void 0 ? void 0 : body.totalElements)
    })
};
/** N11 REST: `{ page, size, totalPages, pageCount, content: [...] }` — toplam kayıt yok. */
const n11Extractor = {
    records: (body) => asArray(body === null || body === void 0 ? void 0 : body.content),
    page: (body) => {
        var _a;
        return ({
            page: asNumber(body === null || body === void 0 ? void 0 : body.page),
            size: asNumber(body === null || body === void 0 ? void 0 : body.size),
            totalPages: (_a = asNumber(body === null || body === void 0 ? void 0 : body.totalPages)) !== null && _a !== void 0 ? _a : asNumber(body === null || body === void 0 ? void 0 : body.pageCount)
        });
    }
};
/** İdefix: `{ items, pageCount }` ya da `{ data: { items, pageCount } }`; bazı uçlar `data: [...]`. */
const idefixExtractor = {
    records: (body) => { var _a, _b, _c, _d; return (_d = (_c = (_a = asArray(body === null || body === void 0 ? void 0 : body.items)) !== null && _a !== void 0 ? _a : asArray((_b = body === null || body === void 0 ? void 0 : body.data) === null || _b === void 0 ? void 0 : _b.items)) !== null && _c !== void 0 ? _c : asArray(body === null || body === void 0 ? void 0 : body.data)) !== null && _d !== void 0 ? _d : asArray(body === null || body === void 0 ? void 0 : body.content); },
    page: (body) => {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        return ({
            page: (_a = asNumber(body === null || body === void 0 ? void 0 : body.page)) !== null && _a !== void 0 ? _a : asNumber((_b = body === null || body === void 0 ? void 0 : body.data) === null || _b === void 0 ? void 0 : _b.page),
            size: (_c = asNumber(body === null || body === void 0 ? void 0 : body.limit)) !== null && _c !== void 0 ? _c : asNumber((_d = body === null || body === void 0 ? void 0 : body.data) === null || _d === void 0 ? void 0 : _d.limit),
            totalPages: (_e = asNumber(body === null || body === void 0 ? void 0 : body.pageCount)) !== null && _e !== void 0 ? _e : asNumber((_f = body === null || body === void 0 ? void 0 : body.data) === null || _f === void 0 ? void 0 : _f.pageCount),
            totalElements: (_g = asNumber(body === null || body === void 0 ? void 0 : body.totalCount)) !== null && _g !== void 0 ? _g : asNumber((_h = body === null || body === void 0 ? void 0 : body.data) === null || _h === void 0 ? void 0 : _h.totalCount)
        });
    }
};
/** Genel yedek: kök dizi ya da yaygın liste anahtarları. */
const genericExtractor = {
    records: (body) => {
        var _a, _b, _c, _d, _e, _f, _g;
        return (_g = (_f = (_d = (_c = (_b = (_a = asArray(body)) !== null && _a !== void 0 ? _a : asArray(body === null || body === void 0 ? void 0 : body.content)) !== null && _b !== void 0 ? _b : asArray(body === null || body === void 0 ? void 0 : body.items)) !== null && _c !== void 0 ? _c : asArray(body === null || body === void 0 ? void 0 : body.data)) !== null && _d !== void 0 ? _d : asArray((_e = body === null || body === void 0 ? void 0 : body.data) === null || _e === void 0 ? void 0 : _e.items)) !== null && _f !== void 0 ? _f : asArray(body === null || body === void 0 ? void 0 : body.orders)) !== null && _g !== void 0 ? _g : asArray(body === null || body === void 0 ? void 0 : body.products);
    },
    page: (body) => ({
        page: asNumber(body === null || body === void 0 ? void 0 : body.page),
        size: asNumber(body === null || body === void 0 ? void 0 : body.size),
        totalPages: asNumber(body === null || body === void 0 ? void 0 : body.totalPages),
        totalElements: asNumber(body === null || body === void 0 ? void 0 : body.totalElements)
    })
};
const READ_RESPONSE_EXTRACTORS = {
    [resourceName_1.ResourceName.Trendyol]: trendyolExtractor,
    [resourceName_1.ResourceName.N11]: n11Extractor,
    [resourceName_1.ResourceName.Idefix]: idefixExtractor
};
/** Kayıt kimliği sayılan alanlar: sipariş no, paket id, barkod. */
const RECORD_ID_FIELDS = ['orderNumber', 'id', 'shipmentPackageId', 'packageNumber', 'claimId', 'barcode'];
/** Kayıt içindeki satır dizileri; satırdan yalnız barkod alınır. */
const RECORD_LINE_FIELDS = ['lines', 'items', 'orderLines', 'packageItems'];
const toKey = (value) => {
    if (typeof value === 'number' && Number.isFinite(value))
        return String(value);
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed && trimmed.length <= 128 ? trimmed : undefined;
    }
    return undefined;
};
/** JSON metinse ayrıştırır; ayrıştırılamazsa undefined. */
function parseJsonBody(body) {
    if (typeof body !== 'string')
        return body;
    const trimmed = body.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('['))
        return undefined;
    try {
        return JSON.parse(trimmed);
    }
    catch (_a) {
        return undefined;
    }
}
/**
 * Gövde bir JSON nesnesi/dizisi mi (nesne ya da JSON metni). Boş gövde de yapısal sayılır: özetlenecek bir şey
 * kaybolmaz. 2xx okumada HTML/düz metin (WAF, bakım sayfası) gelirse gövde özetlenmez, tam saklanır.
 */
function isStructuredResponseBody(body) {
    if (body === undefined || body === null || body === '')
        return true;
    const parsed = parseJsonBody(body);
    return parsed !== null && typeof parsed === 'object';
}
class KeyCollector {
    constructor(max) {
        this.max = max;
        this.keys = [];
        this.seen = new Set();
        this.truncated = false;
    }
    add(value) {
        const key = toKey(value);
        if (key === undefined || this.seen.has(key))
            return true;
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
function summarizeReadResponse(integrationName, body, bytes) {
    const parsed = parseJsonBody(body);
    const platform = integrationName ? READ_RESPONSE_EXTRACTORS[integrationName] : undefined;
    let extractor = platform !== null && platform !== void 0 ? platform : genericExtractor;
    let records = parsed === undefined ? undefined : extractor.records(parsed);
    if (!records && platform) {
        extractor = genericExtractor;
        records = parsed === undefined ? undefined : extractor.records(parsed);
    }
    const ids = new KeyCollector(exports.INTEGRATION_LOG_SUMMARY_MAX_IDS);
    if (records) {
        outer: for (const record of records) {
            if (!record || typeof record !== 'object') {
                if (!ids.add(record))
                    break;
                continue;
            }
            const item = record;
            for (const field of RECORD_ID_FIELDS) {
                if (!ids.add(item[field]))
                    break outer;
            }
            for (const lineField of RECORD_LINE_FIELDS) {
                const lines = item[lineField];
                if (!Array.isArray(lines))
                    continue;
                for (const line of lines) {
                    if (line && typeof line === 'object' && !ids.add(line.barcode))
                        break outer;
                }
            }
        }
    }
    const page = parsed === undefined ? {} : extractor.page(parsed);
    const summary = {
        omitted: true,
        reason: 'successful-read',
        bytes,
        ids: ids.keys,
        idsTruncated: ids.truncated
    };
    if (records)
        summary.recordCount = records.length;
    Object.keys(page).forEach((field) => {
        if (page[field] !== undefined)
            summary[field] = page[field];
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
function collectBodyKeys(body, collector) {
    const parsed = parseJsonBody(body);
    if (parsed === undefined || parsed === null || typeof parsed !== 'object')
        return;
    let visited = 0;
    const walk = (value, depth) => {
        if (++visited > MAX_WALK_NODES || depth > MAX_WALK_DEPTH)
            return true;
        if (Array.isArray(value)) {
            for (const item of value)
                if (!walk(item, depth + 1))
                    return false;
            return true;
        }
        if (!value || typeof value !== 'object')
            return true;
        for (const [name, item] of Object.entries(value)) {
            if (SEARCH_KEY_FIELDS.has(name.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
                if (Array.isArray(item)) {
                    for (const entry of item)
                        if (!collector.add(entry))
                            return false;
                }
                else if (!collector.add(item)) {
                    return false;
                }
            }
            if (item && typeof item === 'object' && !walk(item, depth + 1))
                return false;
        }
        return true;
    };
    walk(parsed, 0);
}
/**
 * Gelişmiş arama için kimlik listesi: özet kimlikleri, istek/yanıt gövdesindeki kimlik alanları
 * ve endpoint yolundaki sayısal/UUID parçalar. Ham (maskelenmemiş) gövdeden çıkarılır; kimlik
 * alanları kişisel veri değildir. En fazla `INTEGRATION_LOG_SEARCH_KEYS_MAX`.
 */
function extractLogSearchKeys(sources) {
    var _a;
    const collector = new KeyCollector(exports.INTEGRATION_LOG_SEARCH_KEYS_MAX);
    if (sources.endpoint) {
        const path = sources.endpoint.split('?')[0];
        for (const segment of path.split('/')) {
            if (PATH_ID_PATTERN.test(segment))
                collector.add(segment);
        }
    }
    for (const id of (_a = sources.summaryIds) !== null && _a !== void 0 ? _a : []) {
        if (!collector.add(id))
            break;
    }
    collectBodyKeys(sources.requestBody, collector);
    collectBodyKeys(sources.responseBody, collector);
    return collector.keys;
}
/** Gelişmiş arama değerinin `searchKeys` sorgusu: tam eşleşme, büyük/küçük harf varyantlarıyla. */
function buildSearchKeysQuery(term) {
    const value = term.trim();
    return { searchKeys: { $in: Array.from(new Set([value, value.toUpperCase(), value.toLowerCase()])) } };
}
