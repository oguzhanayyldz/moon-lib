import { IntegrationRequestLogAttrs, IntegrationRequestLogDoc, IntegrationRequestLogModel, InterpretedResponse } from '../models/integrationRequestLog.schema';
import { ResourceName } from '../common';
import { OperationType } from '../enums/operation-type.enum';
import { ResponseInterpreterFactory } from './response-interpreters/interpreter.factory';
import { logger } from './logger.service';
import { isSensitiveFieldName, redactSensitiveFields, redactSensitiveText, REDACTED_FIELD_MASK, escapeRegExp, redactPersonalData } from '../utils/logSafety.util';
import {
    buildSearchKeysQuery,
    computeLogExpireAt,
    extractLogSearchKeys,
    INTEGRATION_LOG_SEARCH_KEYS_MAX,
    isReadOperation,
    isStructuredResponseBody,
    isSuccessfulLogOutcome,
    measureBodyBytes,
    summarizeReadResponse
} from '../utils/integrationRequestLogPolicy.util';
import mongoose from 'mongoose';

/** Loga yazılan istek/yanıt gövdesinin üst sınırı (UTF-8 bayt, UC-962). */
export const INTEGRATION_LOG_BODY_MAX_BYTES = 64 * 1024;

/**
 * Liste uçlarının projeksiyonu (UC-979): gövde ve header'lar listede taşınmaz (sayfa başına 50 × 64 KB);
 * detay ucu (`getLogDetail`) tam kaydı döner. Boyutlar `requestBytes`/`responseBytes` alanlarından gelir.
 */
export const INTEGRATION_LOG_LIST_PROJECTION = {
    requestBody: 0,
    responseBody: 0,
    requestHeaders: 0,
    responseHeaders: 0,
    searchKeys: 0
} as const;

/**
 * Liste satırına boyut alanlarını ekler (rotaların eski gövde ölçümü yerine). UC-979 öncesi kayıtlarda
 * bayt alanı yoktur: boyut null döner (istemci "-" gösterir; bu kayıtlar en geç 7 günde silinir).
 */
export function withIntegrationLogSizes<T extends { requestBytes?: number; responseBytes?: number }>(log: T) {
    const requestSize = typeof log.requestBytes === 'number' ? log.requestBytes : null;
    const responseSize = typeof log.responseBytes === 'number' ? log.responseBytes : null;
    const totalSize = requestSize === null && responseSize === null ? null : (requestSize ?? 0) + (responseSize ?? 0);
    return { ...log, requestSize, responseSize, totalSize };
}

/**
 * Admin log listesinde sıralanabilen alanlar (UC-800): yalnız indeksli `requestTime`.
 * İndekssiz alanda sıralama entegrasyonun tüm loglarını bellekte sıralatır; listede olmayan alan
 * istenirse `requestTime`'a düşülür.
 */
export const ADMIN_LOG_SORT_FIELDS = ['requestTime'] as const;

export interface AdminLogListParams {
    sortField: string;
    sortOrder: 'asc' | 'desc';
    startDate?: Date;
    endDate?: Date;
    statusCode?: number;
}

const toValidDate = (value: unknown): Date | undefined => {
    if (typeof value !== 'string' || !value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
};

/**
 * Admin log rotalarının liste sorgu parametrelerini tek sözleşmeye çevirir (UC-800).
 * İstemci adları: `startDate`/`endDate`, `statusCode`, `sortField`/`sort`.
 * Geriye uyum: eski `dateFrom`/`dateTo` ve `sortOrder` adları da okunur (yeni ad önceliklidir).
 */
export function parseAdminLogListParams(query: Record<string, unknown> = {}): AdminLogListParams {
    const requestedSortField = typeof query.sortField === 'string' ? query.sortField : '';
    const sortField = (ADMIN_LOG_SORT_FIELDS as readonly string[]).includes(requestedSortField)
        ? requestedSortField
        : 'requestTime';
    const requestedOrder = query.sort ?? query.sortOrder;
    const sortOrder: 'asc' | 'desc' = requestedOrder === 'asc' ? 'asc' : 'desc';
    const statusCode = typeof query.statusCode === 'string' && /^[1-5]\d{2}$/.test(query.statusCode)
        ? Number(query.statusCode)
        : undefined;

    return {
        sortField,
        sortOrder,
        startDate: toValidDate(query.startDate ?? query.dateFrom),
        endDate: toValidDate(query.endDate ?? query.dateTo),
        statusCode
    };
}

export interface LogIntegrationRequestOptions {
    integrationName: ResourceName;
    userId: string;
    operationType?: OperationType; // İşlem kategorisi
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
    duration?: number; // Optional: Real HTTP request duration from caller (ms)
    metadata?: Record<string, any>; // Optional: Additional metadata (e.g., rate limit info)
}

export class IntegrationRequestLogService {
    private connection: mongoose.Connection;

    constructor(connection: mongoose.Connection) {
        this.connection = connection;
    }

    private get IntegrationRequestLogModel() {
        return this.connection.model<IntegrationRequestLogDoc, IntegrationRequestLogModel>('IntegrationRequestLog');
    }

    /**
     * Entegrasyon isteği başlatıldığında log kaydı oluşturur
     */
    async logRequest(options: LogIntegrationRequestOptions): Promise<string> {
        try {
            const requestTime = new Date();
            
            // Hassas bilgileri temizle
            const sanitizedHeaders = IntegrationRequestLogService.sanitizeHeaders(options.requestHeaders || {});
            const sanitizedBody = IntegrationRequestLogService.sanitizeRequestBody(options.requestBody || {});
            
            const logData: IntegrationRequestLogAttrs = {
                integrationName: options.integrationName,
                userId: options.userId,
                operationType: options.operationType,
                method: options.method,
                endpoint: options.endpoint,
                requestHeaders: sanitizedHeaders,
                requestBody: sanitizedBody,
                requestTime,
                // UC-979: yanıt gelmezse (zaman aşımı, süreç çökmesi) kayıt hata sayılır; logResponse kesin süreyi yazar
                expireAt: computeLogExpireAt(requestTime, false),
                // Kimlikler ham gövdeden: maskeli/kırpılmış gövdede eksik kalabilirler
                searchKeys: extractLogSearchKeys({ endpoint: options.endpoint, requestBody: options.requestBody }),
                requestBytes: measureBodyBytes(options.requestBody),
                metadata: options.metadata
            };

            const logEntry = new this.IntegrationRequestLogModel(logData);
            await logEntry.save();
            
            logger.debug(`Integration request logged`, {
                integrationName: options.integrationName,
                userId: options.userId,
                method: options.method,
                endpoint: options.endpoint,
                logId: logEntry.id
            });

            return logEntry.id;
        } catch (error) {
            logger.error('Error logging integration request:', error);
            throw error;
        }
    }

    /**
     * Entegrasyon yanıtı alındığında log kaydını günceller
     *
     * Duration handling:
     * - If options.duration is provided (real HTTP request duration from caller), use it
     * - Otherwise, calculate duration from requestTime to responseTime (log write duration)
     *
     * Note: For accurate HTTP request timing, caller should pass the real duration
     */
    async logResponse(logId: string, options: LogIntegrationResponseOptions): Promise<void> {
        try {
            const responseTime = new Date();

            // Hassas bilgileri temizle
            const sanitizedResponseHeaders = IntegrationRequestLogService.sanitizeHeaders(options.responseHeaders || {});

            const logEntry = await this.IntegrationRequestLogModel.findById(logId);
            if (!logEntry) {
                logger.warn(`Integration request log not found for ID: ${logId}`);
                return;
            }

            // Use provided duration if available (real HTTP request duration)
            // Otherwise calculate from timestamps (backward compatibility)
            const duration = options.duration ?? (responseTime.getTime() - logEntry.requestTime.getTime());

            // Metadata'yı da kaydet (rate limit bilgileri vs.)
            const responseBytes = measureBodyBytes(options.responseBody);
            const updateData: any = {
                responseStatus: options.responseStatus,
                responseHeaders: sanitizedResponseHeaders,
                errorMessage: options.errorMessage,
                duration,
                responseTime,
                responseBytes
            };
            // Gövde sanitize'ı WAF önizlemesi ve tam saklama için gerekli; başarılı okumada hiç üretilmez
            let sanitizedBodyCache: any;
            const sanitizedResponseBody = () =>
                sanitizedBodyCache ??= IntegrationRequestLogService.sanitizeResponseBody(options.responseBody || {});

            // Metadata varsa ekle
            if (options.metadata) {
                updateData.metadata = options.metadata;
            }

            // Response interpretation: Yanıtı yorumla ve kaydet
            if (logEntry.operationType && options.responseBody) {
                if (IntegrationRequestLogService.looksLikeBlockedResponse(options.responseStatus, options.responseBody)) {
                    // WAF/engelleme sayfası (Cloudflare "Attention Required!" HTML vb.): platform interpreter'ları
                    // tanınmayan gövdede koşulsuz success:true dönen bir fallback'e sahip. Interpreter'a hiç
                    // girmeden, HTTP durumuna dayalı deterministik bir başarısızlık üret.
                    updateData.interpretedResponse = {
                        summary: `HTTP ${options.responseStatus}: yanıt yorumlanamadı (olası WAF/engelleme)`,
                        success: false,
                        successCount: 0,
                        failureCount: 1,
                        details: {
                            responseStatus: options.responseStatus,
                            // Ham gövde değil: kimlik alanları maskelenmiş sürüm (responseBody ile aynı redaksiyon)
                            bodyPreview: String(sanitizedResponseBody()).slice(0, 300)
                        },
                        parsedAt: new Date()
                    } as InterpretedResponse;
                    logger.debug('Response marked as blocked (WAF/engelleme), skipping platform interpreter', {
                        logId,
                        operationType: logEntry.operationType,
                        responseStatus: options.responseStatus
                    });
                } else {
                    try {
                        const interpreter = ResponseInterpreterFactory.getInterpreter(logEntry.integrationName);
                        if (interpreter) {
                            const interpretedResponse = interpreter.interpret(options.responseBody, logEntry.operationType);
                            if (interpretedResponse) {
                                // Yorumlayıcılar müşteri alanlarını details'e kopyalayabilir (T-Soft UPDATE_ORDER)
                                updateData.interpretedResponse = redactPersonalData(interpretedResponse);
                                logger.debug('Response interpreted successfully', {
                                    logId,
                                    operationType: logEntry.operationType,
                                    summary: interpretedResponse.summary
                                });
                            }
                        }
                    } catch (interpretError) {
                        logger.warn('Failed to interpret response, continuing without interpretation', {
                            logId,
                            error: (interpretError as Error).message
                        });
                    }
                }
            }

            // UC-979 saklama politikası: sonucu sınıflandır, gövdeyi ya özetle ya tam sakla, süreyi ayarla
            const blocked = IntegrationRequestLogService.looksLikeBlockedResponse(options.responseStatus, options.responseBody);
            const success = isSuccessfulLogOutcome({
                responseStatus: options.responseStatus,
                interpretedSuccess: updateData.interpretedResponse?.success,
                blocked,
                errorMessage: options.errorMessage
            });
            let summaryIds: string[] | undefined;
            if (success && isReadOperation(logEntry.operationType) && isStructuredResponseBody(options.responseBody)) {
                const summary = summarizeReadResponse(logEntry.integrationName, options.responseBody, responseBytes);
                updateData.responseBody = null;
                updateData.responseSummary = summary;
                summaryIds = summary.ids;
            } else {
                updateData.responseBody = sanitizedResponseBody();
            }
            updateData.expireAt = computeLogExpireAt(logEntry.requestTime, success);
            if (options.responseStatus === 409 && IntegrationRequestLogService.bodyReportsSuccess(options.responseBody)) {
                updateData.idempotentSuccess = true;
            }
            const responseKeys = extractLogSearchKeys({
                summaryIds,
                responseBody: summaryIds ? undefined : options.responseBody
            });
            if (responseKeys.length > 0) {
                updateData.searchKeys = Array.from(new Set([...(logEntry.searchKeys ?? []), ...responseKeys]))
                    .slice(0, INTEGRATION_LOG_SEARCH_KEYS_MAX * 2);
            }

            await this.IntegrationRequestLogModel.findByIdAndUpdate(logId, updateData);

            logger.debug(`Integration response logged`, {
                logId,
                responseStatus: options.responseStatus,
                duration,
                durationSource: options.duration ? 'caller' : 'calculated',
                hasError: !!options.errorMessage,
                hasInterpretation: !!updateData.interpretedResponse
            });
        } catch (error) {
            logger.error('Error logging integration response:', error);
            throw error;
        }
    }

    /**
     * Kullanıcının entegrasyon loglarını getirir
     */
    async getUserLogs(
        userId: string,
        integrationName?: ResourceName,
        page: number = 1,
        limit: number = 50,
        sortField: string = 'requestTime',
        sortOrder: string = 'desc',
        filters?: {
            operationType?: OperationType;
            method?: string;
            success?: boolean | 'partial';
            search?: string;
            advancedSearch?: string; // Kimlik araması: sipariş no / paket id / barkod (searchKeys)
            startDate?: Date;
            endDate?: Date;
        }
    ) {
        try {
            const query: any = { userId };

            if (integrationName) {
                query.integrationName = integrationName;
            }

            if (filters?.operationType) {
                query.operationType = filters.operationType;
            }

            if (filters?.method) {
                query.method = filters.method;
            }

            if (filters?.success !== undefined) {
                // Success is a virtual field, filter by responseStatus instead.
                // 207 (Multi-Status) kısmi başarıdır — ne "success" ne "failed" filtresine dahil,
                // ayrı "partial" değeriyle sorgulanır (batch toplu gönderim özet düzeltmesi — Parça 2).
                if (filters.success === 'partial') {
                    query.responseStatus = 207;
                } else if (filters.success) {
                    // 409 + success:true (idempotentSuccess) istemcide "Başarılı" gösterilir — filtre de saysın (UC-569 Ö-4)
                    query.$and = query.$and || [];
                    query.$and.push({
                        $or: [
                            { responseStatus: { $gte: 200, $lt: 300, $ne: 207 } },
                            { idempotentSuccess: true }
                        ]
                    });
                } else {
                    // $or search filtresiyle aynı anahtarı ezmemesi için $and'e itiliyor (issue #877 ek bulgu 3)
                    query.$and = query.$and || [];
                    query.$and.push({
                        $or: [
                            { responseStatus: { $exists: false } },
                            { responseStatus: { $lt: 200 } },
                            { responseStatus: { $gte: 300 } }
                        ]
                    }, { idempotentSuccess: { $ne: true } });
                }
            }

            if (filters?.search) {
                query.$and = query.$and || [];
                const escapedSearch = escapeRegExp(filters.search);
                query.$and.push({
                    $or: [
                        { endpoint: { $regex: escapedSearch, $options: 'i' } },
                        { 'metadata.description': { $regex: escapedSearch, $options: 'i' } }
                    ]
                });
            }

            // Gelişmiş arama (UC-979): gövde regex'i yerine kimlik listesinde (sipariş no, paket id, barkod) tam eşleşme —
            // gövde taraması tam koleksiyon taramasıydı ve başarılı okumalarda gövde artık saklanmıyor.
            // Endpoint'te serbest metin araması normal `search` filtresindedir.
            if (filters?.advancedSearch && filters.advancedSearch.trim()) {
                query.$and = query.$and || [];
                query.$and.push(buildSearchKeysQuery(filters.advancedSearch));
            }

            // Tarih aralığı filtresi
            if (filters?.startDate || filters?.endDate) {
                query.requestTime = {};
                if (filters.startDate) query.requestTime.$gte = filters.startDate;
                if (filters.endDate) query.requestTime.$lte = filters.endDate;
            }

            const skip = (page - 1) * limit;
            const sortObj: any = {};
            sortObj[sortField] = sortOrder === 'asc' ? 1 : -1;
            
            const [logs, total] = await Promise.all([
                this.IntegrationRequestLogModel.find(query, INTEGRATION_LOG_LIST_PROJECTION)
                    .sort(sortObj)
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                this.IntegrationRequestLogModel.countDocuments(query)
            ]);

            return {
                logs,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            logger.error('Error fetching user integration logs:', error);
            throw error;
        }
    }

    /**
     * Admin için tüm entegrasyon loglarını getirir
     */
    async getAllLogs(
        integrationName?: ResourceName,
        userId?: string,
        page: number = 1,
        limit: number = 50,
        startDate?: Date,
        endDate?: Date
    ) {
        try {
            const query: any = {};
            
            if (integrationName) {
                query.integrationName = integrationName;
            }
            
            if (userId) {
                query.userId = userId;
            }
            
            if (startDate || endDate) {
                query.requestTime = {};
                if (startDate) query.requestTime.$gte = startDate;
                if (endDate) query.requestTime.$lte = endDate;
            }

            const skip = (page - 1) * limit;
            
            const [logs, total] = await Promise.all([
                this.IntegrationRequestLogModel.find(query, INTEGRATION_LOG_LIST_PROJECTION)
                    .sort({ requestTime: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                this.IntegrationRequestLogModel.countDocuments(query)
            ]);

            return {
                logs,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            logger.error('Error fetching all integration logs:', error);
            throw error;
        }
    }

    /**
     * Belirli bir log kaydının detayını getirir
     */
    async getLogDetail(logId: string, userId?: string) {
        try {
            const query: any = { _id: logId };
            
            // Admin değilse sadece kendi loglarını görebilir
            if (userId) {
                query.userId = userId;
            }

            const log = await this.IntegrationRequestLogModel.findOne(query).lean();
            
            if (!log) {
                throw new Error('Integration log not found or access denied');
            }

            return log;
        } catch (error) {
            logger.error('Error fetching integration log detail:', error);
            throw error;
        }
    }

    /**
     * Belirtilen günden eski log kayıtlarını temizler (hard delete)
     */
    async cleanupOldLogs(retentionDays: number = 7): Promise<{ deletedCount: number; message: string }> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
            
            logger.info(`Starting cleanup of integration logs older than ${retentionDays} days (before ${cutoffDate.toISOString()})`);
            
            const result = await this.IntegrationRequestLogModel.deleteMany({
                requestTime: { $lt: cutoffDate }
            });
            
            const deletedCount = result.deletedCount || 0;
            const message = `Successfully deleted ${deletedCount} integration log entries older than ${retentionDays} days`;
            
            logger.info(message, {
                deletedCount,
                retentionDays,
                cutoffDate: cutoffDate.toISOString()
            });
            
            return {
                deletedCount,
                message
            };
        } catch (error) {
            logger.error('Error during integration logs cleanup:', error);
            throw error;
        }
    }

    /**
     * Admin için entegrasyon loglarını getirir (Admin route'lar için alias)
     */
    async getAdminLogs(
        integrationName?: ResourceName,
        page: number = 1,
        limit: number = 50,
        sortField: string = 'requestTime',
        sortOrder: 'asc' | 'desc' = 'desc',
        filters?: {
            userId?: string;
            operationType?: OperationType;
            method?: string;
            success?: boolean | 'partial';
            search?: string;
            advancedSearch?: string;
            startDate?: Date;
            endDate?: Date;
            statusCode?: number;
        }
    ) {
        try {
            const query: any = {};

            if (integrationName) {
                query.integrationName = integrationName;
            }

            if (filters?.userId) {
                query.userId = filters.userId;
            }

            if (filters?.operationType) {
                query.operationType = filters.operationType;
            }

            if (filters?.method) {
                query.method = filters.method;
            }

            if (filters?.success !== undefined) {
                // Success is a virtual field, filter by responseStatus instead.
                // 207 (Multi-Status) kısmi başarıdır — ayrı "partial" değeriyle sorgulanır.
                if (filters.success === 'partial') {
                    query.responseStatus = 207;
                } else if (filters.success) {
                    // 409 + success:true (idempotentSuccess) istemcide "Başarılı" gösterilir — filtre de saysın (UC-569 Ö-4)
                    query.$and = query.$and || [];
                    query.$and.push({
                        $or: [
                            { responseStatus: { $gte: 200, $lt: 300, $ne: 207 } },
                            { idempotentSuccess: true }
                        ]
                    });
                } else {
                    // $or search filtresiyle aynı anahtarı ezmemesi için $and'e itiliyor (issue #877 ek bulgu 3)
                    query.$and = query.$and || [];
                    query.$and.push({
                        $or: [
                            { responseStatus: { $exists: false } },
                            { responseStatus: { $lt: 200 } },
                            { responseStatus: { $gte: 300 } }
                        ]
                    }, { idempotentSuccess: { $ne: true } });
                }
            }

            if (filters?.search) {
                const escapedSearch = escapeRegExp(filters.search);
                query.$and = query.$and || [];
                query.$and.push({
                    $or: [
                        { endpoint: { $regex: escapedSearch, $options: 'i' } },
                        { 'metadata.description': { $regex: escapedSearch, $options: 'i' } }
                    ]
                });
            }

            // Gelişmiş arama (UC-979): gövde regex'i yerine kimlik listesinde (sipariş no, paket id, barkod) tam eşleşme —
            // gövde taraması tam koleksiyon taramasıydı ve başarılı okumalarda gövde artık saklanmıyor.
            // Endpoint'te serbest metin araması normal `search` filtresindedir.
            if (filters?.advancedSearch && filters.advancedSearch.trim()) {
                query.$and = query.$and || [];
                query.$and.push(buildSearchKeysQuery(filters.advancedSearch));
            }

            // HTTP kodu (UC-800): `success` filtresiyle aynı alanı ezmemesi için $and'e itiliyor
            if (filters?.statusCode !== undefined) {
                query.$and = query.$and || [];
                query.$and.push({ responseStatus: filters.statusCode });
            }

            // Tarih aralığı filtresi (UC-800)
            if (filters?.startDate || filters?.endDate) {
                query.requestTime = {};
                if (filters.startDate) query.requestTime.$gte = filters.startDate;
                if (filters.endDate) query.requestTime.$lte = filters.endDate;
            }

            const skip = (page - 1) * limit;
            const sortObj: any = {};
            // Yalnız indeksli alanda sıralama (UC-800); listede olmayan alan requestTime'a düşer
            const safeSortField = (ADMIN_LOG_SORT_FIELDS as readonly string[]).includes(sortField) ? sortField : 'requestTime';
            sortObj[safeSortField] = sortOrder === 'asc' ? 1 : -1;

            const [logs, total] = await Promise.all([
                this.IntegrationRequestLogModel.find(query, INTEGRATION_LOG_LIST_PROJECTION)
                    .sort(sortObj)
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                this.IntegrationRequestLogModel.countDocuments(query)
            ]);

            return {
                logs,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            logger.error('Error fetching admin integration logs:', error);
            throw error;
        }
    }

    /**
     * Log detayını getirir (ID bazlı, alias metod)
     */
    async getLogById(logId: string, userId?: string) {
        return this.getLogDetail(logId, userId);
    }

    /**
     * Belirtilen ID'lerdeki logları siler (bulk delete)
     */
    async deleteLogs(logIds: string[], userId?: string): Promise<{ deletedCount: number; message: string }> {
        try {
            const query: any = { _id: { $in: logIds } };
            
            // Admin değilse sadece kendi loglarını silebilir
            if (userId) {
                query.userId = userId;
            }
            
            const result = await this.IntegrationRequestLogModel.deleteMany(query);
            const deletedCount = result.deletedCount || 0;
            const message = `Successfully deleted ${deletedCount} integration log entries`;
            
            logger.info(message, {
                deletedCount,
                requestedIds: logIds.length,
                userId
            });
            
            return {
                deletedCount,
                message
            };
        } catch (error) {
            logger.error('Error deleting integration logs:', error);
            throw error;
        }
    }

    /**
     * Belirtilen tarih aralığı ve entegrasyon bazında logları siler
     */
    async deleteLogsByDateAndIntegration(
        integrationName: ResourceName,
        startDate?: Date,
        endDate?: Date,
        retentionDays?: number
    ): Promise<{ deletedCount: number; message: string }> {
        try {
            const query: any = { integrationName };
            
            if (retentionDays) {
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
                query.requestTime = { $lt: cutoffDate };
            } else if (startDate || endDate) {
                query.requestTime = {};
                if (startDate) query.requestTime.$gte = startDate;
                if (endDate) query.requestTime.$lte = endDate;
            }
            
            const result = await this.IntegrationRequestLogModel.deleteMany(query);
            const deletedCount = result.deletedCount || 0;
            const message = `Successfully deleted ${deletedCount} ${integrationName} integration log entries`;
            
            logger.info(message, {
                deletedCount,
                integrationName,
                startDate,
                endDate,
                retentionDays
            });
            
            return {
                deletedCount,
                message
            };
        } catch (error) {
            logger.error('Error deleting integration logs by date and integration:', error);
            throw error;
        }
    }

    /**
     * Entegrasyon bazında log istatistiklerini getirir
     */
    async getLogStatistics(userId?: string): Promise<{
        totalLogs: number;
        byIntegration: Record<string, number>;
        oldestLog?: Date;
        newestLog?: Date;
        sizeEstimateKB: number;
        totalSize: number;
        averageResponseTime: number;
        todayLogsCount: number;
    }> {
        try {
            const query: any = {};
            if (userId) {
                query.userId = userId;
            }
            
            // Bugün için tarih aralığı oluştur (gün başlangıcından itibaren)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Bugünkü loglar için query
            const todayQuery = {
                ...query,
                requestTime: { $gte: today }
            };
            
            const [
                totalLogs,
                byIntegrationStats,
                oldestLog,
                newestLog,
                sizeStats,
                averageResponseTimeStats,
                todayLogsCount
            ] = await Promise.all([
                this.IntegrationRequestLogModel.countDocuments(query),
                this.IntegrationRequestLogModel.aggregate([
                    { $match: query },
                    { $group: { _id: '$integrationName', count: { $sum: 1 } } }
                ]),
                this.IntegrationRequestLogModel.findOne(query, { requestTime: 1 })
                    .sort({ requestTime: 1 }).lean(),
                this.IntegrationRequestLogModel.findOne(query, { requestTime: 1 })
                    .sort({ requestTime: -1 }).lean(),
                this.IntegrationRequestLogModel.aggregate([
                    { $match: query },
                    { 
                        $project: {
                            requestSize: {
                                $switch: {
                                    branches: [
                                        { case: { $eq: [{ $type: '$requestBody' }, 'string'] }, then: { $strLenBytes: '$requestBody' } },
                                        { case: { $in: [{ $type: '$requestBody' }, ['object']] }, then: { $bsonSize: '$requestBody' } }
                                    ],
                                    default: 0
                                }
                            },
                            responseSize: {
                                $switch: {
                                    branches: [
                                        { case: { $eq: [{ $type: '$responseBody' }, 'string'] }, then: { $strLenBytes: '$responseBody' } },
                                        { case: { $in: [{ $type: '$responseBody' }, ['object']] }, then: { $bsonSize: '$responseBody' } }
                                    ],
                                    default: 0
                                }
                            }
                        } 
                    },
                    { 
                        $group: { 
                            _id: null, 
                            totalSize: { $sum: { $add: ['$requestSize', '$responseSize'] } } 
                        } 
                    }
                ]),
                this.IntegrationRequestLogModel.aggregate([
                    { $match: { ...query, duration: { $exists: true, $ne: null } } },
                    { 
                        $group: { 
                            _id: null, 
                            averageDuration: { $avg: '$duration' } 
                        } 
                    }
                ]),
                this.IntegrationRequestLogModel.countDocuments(todayQuery)
            ]);
            
            const byIntegration: Record<string, number> = {};
            byIntegrationStats.forEach((stat: any) => {
                byIntegration[stat._id] = stat.count;
            });
            
            // Gerçek toplam boyutu hesapla, yoksa tahmin et
            const totalSize = sizeStats && sizeStats[0] ? sizeStats[0].totalSize : 0;
            
            // Rough size estimate (each document ~2-5KB average)
            const sizeEstimateKB = totalSize > 0 ? Math.round(totalSize / 1024) : totalLogs * 3;
            
            // Ortalama yanıt süresini hesapla
            const averageResponseTime = averageResponseTimeStats && averageResponseTimeStats[0] 
                ? Math.round(averageResponseTimeStats[0].averageDuration)
                : 0;
            
            return {
                totalLogs,
                byIntegration,
                oldestLog: oldestLog?.requestTime,
                newestLog: newestLog?.requestTime,
                sizeEstimateKB,
                totalSize,
                averageResponseTime,
                todayLogsCount
            };
        } catch (error) {
            logger.error('Error fetching integration log statistics:', error);
            throw error;
        }
    }

    /**
     * WAF/engelleme sayfası tespiti (TASK-MUDY1TB6EDJAJ): hata durum kodu + JSON olmayan
     * (tipik olarak HTML) bir gövde. Platform interpreter'larının "tanınmayan gövde" fallback'i
     * koşulsuz `success:true` döndüğünden, bu şekli interpreter'a hiç göndermiyoruz.
     */
    private static looksLikeBlockedResponse(responseStatus: number | undefined, responseBody: any): boolean {
        if (typeof responseBody !== 'string') return false;
        // Yalnız hata durum kodunda: 2xx düz metin gövdede "cloudflare" vb. geçmesi engelleme sayılmaz.
        return typeof responseStatus === 'number' && responseStatus >= 300;
    }

    /**
     * Header'lardaki kimlik bilgilerini temizler (n11 `appkey`/`appsecret`, HepsiJet `X-Auth-Token`,
     * `Authorization`, `Set-Cookie` …). Ad kuralı gövdeyle aynıdır: `isSensitiveFieldName`.
     */
    private static sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
        const sanitized = { ...headers };

        Object.keys(sanitized).forEach(headerKey => {
            if (isSensitiveFieldName(headerKey)) {
                sanitized[headerKey] = REDACTED_FIELD_MASK;
            }
        });

        return sanitized;
    }

    /**
     * JSON body'yi girintisiz JSON metnine dönüştürür (istemci görüntüleyicisi kendisi biçimlendirir)
     * String ise parse edip tekrar serileştirir
     * MongoDB'de string olarak saklanır
     */
    private static formatBodyForStorage(body: any): any {
        if (!body) return null;

        // Eğer zaten string ise JSON parse etmeye çalış
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch {
                // Parse edilemiyorsa olduğu gibi döndür
                return body;
            }
        }

        // Object ise girintisiz (compact) JSON olarak döndür (UC-979: girinti gövdeyi ~%30 büyütüyordu)
        if (typeof body === 'object') {
            try {
                return JSON.stringify(body);
            } catch {
                // Stringify edilemiyorsa toString kullan
                return String(body);
            }
        }

        return body;
    }

    /**
     * Saklanan gövdeyi üst sınırla kırpar (UC-962): tek bir sipariş yanıtı ~1,35 MB'tı ve
     * `trendyol.integrationrequestlogs` 47 GB'a çıktı. Kırpma redaksiyondan SONRA yapılır,
     * yarım kalan bir sır açığa çıkmaz. Sınır UTF-8 bayt üzerinden; çok baytlı karakter
     * ortadan bölünmez.
     */
    private static truncateForStorage(body: any): any {
        if (typeof body !== 'string') return body;

        const totalBytes = Buffer.byteLength(body, 'utf8');
        if (totalBytes <= INTEGRATION_LOG_BODY_MAX_BYTES) return body;

        const head = Buffer.from(body, 'utf8')
            .subarray(0, INTEGRATION_LOG_BODY_MAX_BYTES)
            .toString('utf8')
            .replace(/�+$/, '');
        return `${head}\n…(kırpıldı, toplam ${totalBytes} bayt)`;
    }

    /**
     * Request body'deki kimlik ve kişisel veriyi maskeler, compact JSON'a dönüştürür ve sınırlar
     * MongoDB'de string olarak saklanır
     */
    private static sanitizeRequestBody(body: Record<string, any>): any {
        return this.truncateForStorage(this.formatBodyForStorage(this.redactBody(body)));
    }

    /**
     * Response body'deki kimlik ve kişisel veriyi maskeler, compact JSON'a dönüştürür ve sınırlar
     * MongoDB'de string olarak saklanır
     */
    private static sanitizeResponseBody(body: Record<string, any>): any {
        return this.truncateForStorage(this.formatBodyForStorage(this.redactBody(body)));
    }

    /**
     * Gövdedeki kimlik alanlarını maskeler (kural: `logSafety.util` → `isSensitiveFieldName`).
     *
     * - Nesne: kimlik adlı alanın değeri (tipi ne olursa olsun) maskelenir; diğer string değerler
     *   de taranır — `{ body: "pass=..." }` ya da `{ data: "<json>" }` gibi sarılı gövdeler için.
     * - String: JSON, XML/SOAP (`<tem:UyeKodu>` dahil) ya da URL-encoded olabilir; üçü de taranır.
     */
    private static redactBody(body: unknown): unknown {
        if (!body) return body;
        // UC-979: sır maskesinden sonra kişisel veri maskesi (ad, adres, telefon, e-posta, TCKN/VKN)
        if (typeof body === 'string') return redactPersonalData(redactSensitiveText(body));
        if (typeof body !== 'object') return body;
        return redactPersonalData(redactSensitiveFields(JSON.parse(JSON.stringify(body))));
    }

    /** 409 gövdesi `success: true` mı (idempotent işlem — istemci başarılı gösterir). */
    private static bodyReportsSuccess(responseBody: unknown): boolean {
        let parsed: any = responseBody;
        if (typeof responseBody === 'string') {
            try {
                parsed = JSON.parse(responseBody);
            } catch {
                return false;
            }
        }
        return !!parsed && typeof parsed === 'object' && parsed.success === true;
    }
}
