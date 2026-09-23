import { IntegrationRequestLogDoc } from '../models/integrationRequestLog.schema';
import { ResourceName } from '../common';
import { OperationType } from '../enums/operation-type.enum';
import mongoose from 'mongoose';
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
        success?: boolean;
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
        success?: boolean;
        search?: string;
        advancedSearch?: string;
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
     * JSON body'yi pretty-print formatına dönüştürür (okunabilir hale getirir)
     * String ise parse edip tekrar format eder
     * MongoDB'de string olarak saklanır
     */
    private static formatBodyForStorage;
    /**
     * Request body'deki kimlik bilgilerini temizler ve pretty-print formatına dönüştürür
     * MongoDB'de string olarak saklanır
     */
    private static sanitizeRequestBody;
    /**
     * Response body'deki kimlik bilgilerini temizler ve pretty-print formatına dönüştürür
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
}
//# sourceMappingURL=integrationRequestLog.service.d.ts.map