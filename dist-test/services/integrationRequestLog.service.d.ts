import { IntegrationRequestLogDoc } from '../models/integrationRequestLog.schema';
import { ResourceName } from '../common';
import mongoose from 'mongoose';
export interface LogIntegrationRequestOptions {
    integrationName: ResourceName;
    userId: string;
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
     */
    logResponse(logId: string, options: LogIntegrationResponseOptions): Promise<void>;
    /**
     * Kullanıcının entegrasyon loglarını getirir
     */
    getUserLogs(userId: string, integrationName?: ResourceName, page?: number, limit?: number, sortField?: string, sortOrder?: string, filters?: {
        method?: string;
        success?: boolean;
        search?: string;
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
        method?: string;
        success?: boolean;
        search?: string;
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
     * Request header'larındaki hassas bilgileri temizler
     */
    private static sanitizeHeaders;
    /**
     * JSON body'yi pretty-print formatına dönüştürür (okunabilir hale getirir)
     * String ise parse edip tekrar format eder
     * MongoDB'de string olarak saklanır
     */
    private static formatBodyForStorage;
    /**
     * Request body'deki hassas bilgileri temizler ve pretty-print formatına dönüştürür
     * MongoDB'de string olarak saklanır
     */
    private static sanitizeRequestBody;
    /**
     * Response body'deki hassas bilgileri temizler ve pretty-print formatına dönüştürür
     * MongoDB'de string olarak saklanır
     */
    private static sanitizeResponseBody;
    /**
     * Nested objelerde hassas bilgileri temizler
     */
    private static recursiveSanitize;
}
//# sourceMappingURL=integrationRequestLog.service.d.ts.map