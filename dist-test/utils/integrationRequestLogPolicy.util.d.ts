import { OperationType } from '../enums/operation-type.enum';
/**
 * Entegrasyon istek logu saklama politikası (UC-979, UC-978 ölçümü).
 *
 * - Başarılı okumada yanıt gövdesi saklanmaz; yerine özet (`ResponseSummary`) yazılır.
 * - Hata ve yazma işlemlerinde tam istek + yanıt saklanır (64 KB sınırı UC-962'den).
 * - Saklama süresi sonuca göre `expireAt` ile: başarı 3 gün, hata 14 gün.
 * - Gelişmiş arama gövde regex'i yerine `searchKeys` kimlik listesinde tam eşleşmeyle yapılır.
 */
export declare const INTEGRATION_LOG_SUCCESS_RETENTION_SECONDS: number;
export declare const INTEGRATION_LOG_FAILURE_RETENTION_SECONDS: number;
/** Özette saklanan en fazla kimlik sayısı. */
export declare const INTEGRATION_LOG_SUMMARY_MAX_IDS = 200;
/** Bir kayıtta aranabilir en fazla kimlik sayısı (istek + yanıt + endpoint). */
export declare const INTEGRATION_LOG_SEARCH_KEYS_MAX = 300;
/**
 * Okuma işlemi mi. Bilinmeyen tür, `OTHER` ve türsüz kayıt yazma sayılır: gövdesi saklanır (güvenli varsayılan).
 */
export declare function isReadOperation(operationType?: OperationType | string | null): boolean;
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
export declare function isSuccessfulLogOutcome(input: LogOutcomeInput): boolean;
/** Kaydın silineceği an: `base` + başarıda 3 gün, hatada 14 gün. */
export declare function computeLogExpireAt(base: Date, success: boolean): Date;
/** Gövdenin UTF-8 bayt boyu (kırpma öncesi). Nesneler compact JSON olarak ölçülür. */
export declare function measureBodyBytes(body: unknown): number;
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
/**
 * Başarılı okuma yanıtının özeti: kayıt sayısı, sayfa bilgisi ve ilk 200 kimlik.
 * Platformun çıkarıcısı liste bulamazsa genel yedeğe düşer.
 */
export declare function summarizeReadResponse(integrationName: string | undefined, body: unknown, bytes: number): ResponseSummary;
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
export declare function extractLogSearchKeys(sources: SearchKeySources): string[];
/** Gelişmiş arama değerinin `searchKeys` sorgusu: tam eşleşme, büyük/küçük harf varyantlarıyla. */
export declare function buildSearchKeysQuery(term: string): {
    searchKeys: {
        $in: string[];
    };
};
//# sourceMappingURL=integrationRequestLogPolicy.util.d.ts.map