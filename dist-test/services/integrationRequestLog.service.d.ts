import { IntegrationRequestLogDoc } from '../models/integrationRequestLog.schema';
import { ResourceName } from '../common';
import { OperationType } from '../enums/operation-type.enum';
import mongoose from 'mongoose';
/** Loga yazılan istek/yanıt gövdesinin üst sınırı (UTF-8 bayt, UC-962). */
export declare const INTEGRATION_LOG_BODY_MAX_BYTES: number;
/**
 * Liste uçlarının projeksiyonu (UC-979): gövde ve header'lar listede taşınmaz (sayfa başına 50 × 64 KB);
 * detay ucu (`getLogDetail`) tam kaydı döner. Boyutlar `requestBytes`/`responseBytes` alanlarından gelir.
 */
export declare const INTEGRATION_LOG_LIST_PROJECTION: {
    readonly requestBody: 0;
    readonly responseBody: 0;
    readonly requestHeaders: 0;
    readonly responseHeaders: 0;
    readonly searchKeys: 0;
};
/**
 * Liste satırına boyut alanlarını ekler (rotaların eski gövde ölçümü yerine). UC-979 öncesi kayıtlarda
 * bayt alanı yoktur: boyut null döner (istemci "-" gösterir; bu kayıtlar en geç 7 günde silinir).
 */
export declare function withIntegrationLogSizes<T extends {
    requestBytes?: number;
    responseBytes?: number;
}>(log: T): T & {
    requestSize: number | null;
    responseSize: number | null;
    totalSize: number | null;
};
/**
 * Admin log listesinde sıralanabilen alanlar (UC-800): yalnız indeksli `requestTime`.
 * İndekssiz alanda sıralama entegrasyonun tüm loglarını bellekte sıralatır; listede olmayan alan
 * istenirse `requestTime`'a düşülür.
 */
export declare const ADMIN_LOG_SORT_FIELDS: readonly ["requestTime"];
export interface AdminLogListParams {
    sortField: string;
    sortOrder: 'asc' | 'desc';
    startDate?: Date;
    endDate?: Date;
    statusCode?: number;
}
/**
 * Admin log rotalarının liste sorgu parametrelerini tek sözleşmeye çevirir (UC-800).
 * İstemci adları: `startDate`/`endDate`, `statusCode`, `sortField`/`sort`.
 * Geriye uyum: eski `dateFrom`/`dateTo` ve `sortOrder` adları da okunur (yeni ad önceliklidir).
 */
export declare function parseAdminLogListParams(query?: Record<string, unknown>): AdminLogListParams;
export interface LogIntegrationRequestOptions {
    integrationName: ResourceName;
    userId: string;
    operationType?: OperationType;
    method: string;
    endpoint: string;
    requestHeaders?: Record<string, any>;
    requestBody?: Record<string, any>;
    metadata?: Record<string, any>;
}
export interface LogIntegrationResponseOptions {
    responseStatus: number;
    responseHeaders?: Record<string, any>;
    responseBody?: Record<string, any>;
    errorMessage?: string;
    duration?: number;
    metadata?: Record<string, any>;
}
export declare class IntegrationRequestLogService {
    private connection;
    constructor(connection: mongoose.Connection);
    private get IntegrationRequestLogModel();
    /**
     * Entegrasyon isteği başlatıldığında log kaydı oluşturur
     */
    logRequest(options: LogIntegrationRequestOptions): Promise<string>;
    /**
     * Entegrasyon yanıtı alındığında log kaydını günceller
     *
     * Duration handling:
     * - If options.duration is provided (real HTTP request duration from caller), use it
     * - Otherwise, calculate duration from requestTime to responseTime (log write duration)
     *
     * Note: For accurate HTTP request timing, caller should pass the real duration
     */
    logResponse(logId: string, options: LogIntegrationResponseOptions): Promise<void>;
    /**
     * Kullanıcının entegrasyon loglarını getirir
     */
    getUserLogs(userId: string, integrationName?: ResourceName, page?: number, limit?: number, sortField?: string, sortOrder?: string, filters?: {
        operationType?: OperationType;
        method?: string;
        success?: boolean | 'partial';
        search?: string;
        advancedSearch?: string;
        startDate?: Date;
        endDate?: Date;
    }): Promise<{
        logs: (mongoose.FlattenMaps<IntegrationRequestLogDoc> & {
            _id: mongoose.Types.ObjectId;
        })[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    }>;
    /**
     * Admin için tüm entegrasyon loglarını getirir
     */
    getAllLogs(integrationName?: ResourceName, userId?: string, page?: number, limit?: number, startDate?: Date, endDate?: Date): Promise<{
        logs: (mongoose.FlattenMaps<IntegrationRequestLogDoc> & {
            _id: mongoose.Types.ObjectId;
        })[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    }>;
    /**
     * Belirli bir log kaydının detayını getirir
     */
    getLogDetail(logId: string, userId?: string): Promise<mongoose.FlattenMaps<IntegrationRequestLogDoc> & {
        _id: mongoose.Types.ObjectId;
    }>;
    /**
     * Belirtilen günden eski log kayıtlarını temizler (hard delete)
     */
    cleanupOldLogs(retentionDays?: number): Promise<{
        deletedCount: number;
        message: string;
    }>;
    /**
     * Admin için entegrasyon loglarını getirir (Admin route'lar için alias)
     */
    getAdminLogs(integrationName?: ResourceName, page?: number, limit?: number, sortField?: string, sortOrder?: 'asc' | 'desc', filters?: {
        userId?: string;
        operationType?: OperationType;
        method?: string;
        success?: boolean | 'partial';
        search?: string;
        advancedSearch?: string;
        startDate?: Date;
        endDate?: Date;
        statusCode?: number;
    }): Promise<{
        logs: (mongoose.FlattenMaps<IntegrationRequestLogDoc> & {
            _id: mongoose.Types.ObjectId;
        })[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    }>;
    /**
     * Log detayını getirir (ID bazlı, alias metod)
     */
    getLogById(logId: string, userId?: string): Promise<mongoose.FlattenMaps<IntegrationRequestLogDoc> & {
        _id: mongoose.Types.ObjectId;
    }>;
    /**
     * Belirtilen ID'lerdeki logları siler (bulk delete)
     */
    deleteLogs(logIds: string[], userId?: string): Promise<{
        deletedCount: number;
        message: string;
    }>;
    /**
     * Belirtilen tarih aralığı ve entegrasyon bazında logları siler
     */
    deleteLogsByDateAndIntegration(integrationName: ResourceName, startDate?: Date, endDate?: Date, retentionDays?: number): Promise<{
        deletedCount: number;
        message: string;
    }>;
    /**
     * Entegrasyon bazında log istatistiklerini getirir
     */
    getLogStatistics(userId?: string): Promise<{
        totalLogs: number;
        byIntegration: Record<string, number>;
        oldestLog?: Date;
        newestLog?: Date;
        sizeEstimateKB: number;
        totalSize: number;
        averageResponseTime: number;
        todayLogsCount: number;
    }>;
    /**
     * WAF/engelleme sayfası tespiti (TASK-MUDY1TB6EDJAJ): hata durum kodu + JSON olmayan
     * (tipik olarak HTML) bir gövde. Platform interpreter'larının "tanınmayan gövde" fallback'i
     * koşulsuz `success:true` döndüğünden, bu şekli interpreter'a hiç göndermiyoruz.
     */
    private static looksLikeBlockedResponse;
    /**
     * Header'lardaki kimlik bilgilerini temizler (n11 `appkey`/`appsecret`, HepsiJet `X-Auth-Token`,
     * `Authorization`, `Set-Cookie` …). Ad kuralı gövdeyle aynıdır: `isSensitiveFieldName`.
     */
    private static sanitizeHeaders;
    /**
     * JSON body'yi girintisiz JSON metnine dönüştürür (istemci görüntüleyicisi kendisi biçimlendirir)
     * String ise parse edip tekrar serileştirir
     * MongoDB'de string olarak saklanır
     */
    private static formatBodyForStorage;
    /**
     * Saklanan gövdeyi üst sınırla kırpar (UC-962): tek bir sipariş yanıtı ~1,35 MB'tı ve
     * `trendyol.integrationrequestlogs` 47 GB'a çıktı. Kırpma redaksiyondan SONRA yapılır,
     * yarım kalan bir sır açığa çıkmaz. Sınır UTF-8 bayt üzerinden; çok baytlı karakter
     * ortadan bölünmez.
     */
    private static truncateForStorage;
    /**
     * Request body'deki kimlik ve kişisel veriyi maskeler, compact JSON'a dönüştürür ve sınırlar
     * MongoDB'de string olarak saklanır
     */
    private static sanitizeRequestBody;
    /**
     * Response body'deki kimlik ve kişisel veriyi maskeler, compact JSON'a dönüştürür ve sınırlar
     * MongoDB'de string olarak saklanır
     */
    private static sanitizeResponseBody;
    /**
     * Gövdedeki kimlik alanlarını maskeler (kural: `logSafety.util` → `isSensitiveFieldName`).
     *
     * - Nesne: kimlik adlı alanın değeri (tipi ne olursa olsun) maskelenir; diğer string değerler
     *   de taranır — `{ body: "pass=..." }` ya da `{ data: "<json>" }` gibi sarılı gövdeler için.
     * - String: JSON, XML/SOAP (`<tem:UyeKodu>` dahil) ya da URL-encoded olabilir; üçü de taranır.
     */
    private static redactBody;
    /** 409 gövdesi `success: true` mı (idempotent işlem — istemci başarılı gösterir). */
    private static bodyReportsSuccess;
}
//# sourceMappingURL=integrationRequestLog.service.d.ts.map