import { IntegrationRequestLogAttrs, IntegrationRequestLogDoc, IntegrationRequestLogModel } from '../models/integrationRequestLog.schema';
import { ResourceName } from '../common';
import { logger } from './logger.service';
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
                method: options.method,
                endpoint: options.endpoint,
                requestHeaders: sanitizedHeaders,
                requestBody: sanitizedBody,
                requestTime,
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
     */
    async logResponse(logId: string, options: LogIntegrationResponseOptions): Promise<void> {
        try {
            const responseTime = new Date();
            
            // Hassas bilgileri temizle
            const sanitizedResponseHeaders = IntegrationRequestLogService.sanitizeHeaders(options.responseHeaders || {});
            const sanitizedResponseBody = IntegrationRequestLogService.sanitizeResponseBody(options.responseBody || {});
            
            const logEntry = await this.IntegrationRequestLogModel.findById(logId);
            if (!logEntry) {
                logger.warn(`Integration request log not found for ID: ${logId}`);
                return;
            }

            const duration = responseTime.getTime() - logEntry.requestTime.getTime();

            await this.IntegrationRequestLogModel.findByIdAndUpdate(logId, {
                responseStatus: options.responseStatus,
                responseHeaders: sanitizedResponseHeaders,
                responseBody: sanitizedResponseBody,
                errorMessage: options.errorMessage,
                duration,
                responseTime
            });

            logger.debug(`Integration response logged`, {
                logId,
                responseStatus: options.responseStatus,
                duration,
                hasError: !!options.errorMessage
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
            method?: string;
            success?: boolean;
            search?: string;
            startDate?: Date;
            endDate?: Date;
        }
    ) {
        try {
            const query: any = { userId };

            if (integrationName) {
                query.integrationName = integrationName;
            }

            if (filters?.method) {
                query.method = filters.method;
            }

            if (filters?.success !== undefined) {
                // Success is a virtual field, filter by responseStatus instead
                if (filters.success) {
                    query.responseStatus = { $gte: 200, $lt: 300 };
                } else {
                    query.$or = [
                        { responseStatus: { $exists: false } },
                        { responseStatus: { $lt: 200 } },
                        { responseStatus: { $gte: 300 } }
                    ];
                }
            }

            if (filters?.search) {
                query.$or = [
                    { endpoint: { $regex: filters.search, $options: 'i' } },
                    { 'metadata.description': { $regex: filters.search, $options: 'i' } }
                ];
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
                this.IntegrationRequestLogModel.find(query)
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
                this.IntegrationRequestLogModel.find(query)
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
            method?: string;
            success?: boolean;
            search?: string;
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

            if (filters?.method) {
                query.method = filters.method;
            }

            if (filters?.success !== undefined) {
                // Success is a virtual field, filter by responseStatus instead
                if (filters.success) {
                    query.responseStatus = { $gte: 200, $lt: 300 };
                } else {
                    query.$or = [
                        { responseStatus: { $exists: false } },
                        { responseStatus: { $lt: 200 } },
                        { responseStatus: { $gte: 300 } }
                    ];
                }
            }

            if (filters?.search) {
                query.$or = [
                    { endpoint: { $regex: filters.search, $options: 'i' } },
                    { 'metadata.description': { $regex: filters.search, $options: 'i' } }
                ];
            }

            const skip = (page - 1) * limit;
            const sortObj: any = {};
            sortObj[sortField] = sortOrder === 'asc' ? 1 : -1;
            
            const [logs, total] = await Promise.all([
                this.IntegrationRequestLogModel.find(query)
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
                                $cond: [
                                    '$requestBody',
                                    { $bsonSize: '$requestBody' },
                                    0
                                ] 
                            },
                            responseSize: { 
                                $cond: [
                                    '$responseBody',
                                    { $bsonSize: '$responseBody' },
                                    0
                                ] 
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
     * Request header'larındaki hassas bilgileri temizler
     */
    private static sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
        const sanitized = { ...headers };
        const sensitiveKeys = ['authorization', 'x-shopify-access-token', 'api-key', 'x-api-key'];
        
        sensitiveKeys.forEach(key => {
            if (sanitized[key]) {
                sanitized[key] = '***REDACTED***';
            }
            if (sanitized[key.toLowerCase()]) {
                sanitized[key.toLowerCase()] = '***REDACTED***';
            }
        });
        
        return sanitized;
    }

    /**
     * Body'yi storage için hazırlar
     * String ise parse edip object döndürür, object ise olduğu gibi döndürür
     * MongoDB'de object olarak saklanır, frontend tarafında pretty-print yapılır
     */
    private static formatBodyForStorage(body: any): any {
        if (!body) return null;

        // Eğer zaten string ise JSON parse etmeye çalış
        if (typeof body === 'string') {
            try {
                return JSON.parse(body);
            } catch {
                // Parse edilemiyorsa string olarak döndür
                return body;
            }
        }

        // Object ise olduğu gibi döndür (MongoDB Mixed type)
        if (typeof body === 'object') {
            return body;
        }

        return body;
    }

    /**
     * Request body'deki hassas bilgileri temizler ve object olarak döndürür
     * MongoDB'de object olarak saklanır, route'da JSON.stringify ile string'e çevrilir
     */
    private static sanitizeRequestBody(body: Record<string, any>): any {
        if (!body || typeof body !== 'object') return this.formatBodyForStorage(body);

        const sanitized = JSON.parse(JSON.stringify(body));
        const sensitiveKeys = ['password', 'token', 'secret', 'key', 'access_token'];

        this.recursiveSanitize(sanitized, sensitiveKeys);

        // Object olarak döndür (route'da stringify edilecek)
        return this.formatBodyForStorage(sanitized);
    }

    /**
     * Response body'deki hassas bilgileri temizler ve object olarak döndürür
     * MongoDB'de object olarak saklanır, route'da JSON.stringify ile string'e çevrilir
     */
    private static sanitizeResponseBody(body: Record<string, any>): any {
        if (!body || typeof body !== 'object') return this.formatBodyForStorage(body);

        const sanitized = JSON.parse(JSON.stringify(body));
        const sensitiveKeys = ['password', 'token', 'secret', 'key', 'access_token'];

        this.recursiveSanitize(sanitized, sensitiveKeys);

        // Object olarak döndür (route'da stringify edilecek)
        return this.formatBodyForStorage(sanitized);
    }

    /**
     * Nested objelerde hassas bilgileri temizler
     */
    private static recursiveSanitize(obj: any, sensitiveKeys: string[]): void {
        if (typeof obj !== 'object' || obj === null) return;
        
        for (const key in obj) {
            if (sensitiveKeys.includes(key.toLowerCase())) {
                obj[key] = '***REDACTED***';
            } else if (typeof obj[key] === 'object') {
                this.recursiveSanitize(obj[key], sensitiveKeys);
            }
        }
    }
}
