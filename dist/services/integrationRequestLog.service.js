"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationRequestLogService = void 0;
const logger_service_1 = require("./logger.service");
class IntegrationRequestLogService {
    constructor(connection) {
        this.connection = connection;
    }
    get IntegrationRequestLogModel() {
        return this.connection.model('IntegrationRequestLog');
    }
    /**
     * Entegrasyon isteği başlatıldığında log kaydı oluşturur
     */
    logRequest(options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestTime = new Date();
                // Hassas bilgileri temizle
                const sanitizedHeaders = IntegrationRequestLogService.sanitizeHeaders(options.requestHeaders || {});
                const sanitizedBody = IntegrationRequestLogService.sanitizeRequestBody(options.requestBody || {});
                const logData = {
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
                yield logEntry.save();
                logger_service_1.logger.debug(`Integration request logged`, {
                    integrationName: options.integrationName,
                    userId: options.userId,
                    method: options.method,
                    endpoint: options.endpoint,
                    logId: logEntry.id
                });
                return logEntry.id;
            }
            catch (error) {
                logger_service_1.logger.error('Error logging integration request:', error);
                throw error;
            }
        });
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
    logResponse(logId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const responseTime = new Date();
                // Hassas bilgileri temizle
                const sanitizedResponseHeaders = IntegrationRequestLogService.sanitizeHeaders(options.responseHeaders || {});
                const sanitizedResponseBody = IntegrationRequestLogService.sanitizeResponseBody(options.responseBody || {});
                const logEntry = yield this.IntegrationRequestLogModel.findById(logId);
                if (!logEntry) {
                    logger_service_1.logger.warn(`Integration request log not found for ID: ${logId}`);
                    return;
                }
                // Use provided duration if available (real HTTP request duration)
                // Otherwise calculate from timestamps (backward compatibility)
                const duration = (_a = options.duration) !== null && _a !== void 0 ? _a : (responseTime.getTime() - logEntry.requestTime.getTime());
                // Metadata'yı da kaydet (rate limit bilgileri vs.)
                const updateData = {
                    responseStatus: options.responseStatus,
                    responseHeaders: sanitizedResponseHeaders,
                    responseBody: sanitizedResponseBody,
                    errorMessage: options.errorMessage,
                    duration,
                    responseTime
                };
                // Metadata varsa ekle
                if (options.metadata) {
                    updateData.metadata = options.metadata;
                }
                yield this.IntegrationRequestLogModel.findByIdAndUpdate(logId, updateData);
                logger_service_1.logger.debug(`Integration response logged`, {
                    logId,
                    responseStatus: options.responseStatus,
                    duration,
                    durationSource: options.duration ? 'caller' : 'calculated',
                    hasError: !!options.errorMessage
                });
            }
            catch (error) {
                logger_service_1.logger.error('Error logging integration response:', error);
                throw error;
            }
        });
    }
    /**
     * Kullanıcının entegrasyon loglarını getirir
     */
    getUserLogs(userId_1, integrationName_1) {
        return __awaiter(this, arguments, void 0, function* (userId, integrationName, page = 1, limit = 50, sortField = 'requestTime', sortOrder = 'desc', filters) {
            try {
                const query = { userId };
                if (integrationName) {
                    query.integrationName = integrationName;
                }
                if (filters === null || filters === void 0 ? void 0 : filters.method) {
                    query.method = filters.method;
                }
                if ((filters === null || filters === void 0 ? void 0 : filters.success) !== undefined) {
                    // Success is a virtual field, filter by responseStatus instead
                    if (filters.success) {
                        query.responseStatus = { $gte: 200, $lt: 300 };
                    }
                    else {
                        query.$or = [
                            { responseStatus: { $exists: false } },
                            { responseStatus: { $lt: 200 } },
                            { responseStatus: { $gte: 300 } }
                        ];
                    }
                }
                if (filters === null || filters === void 0 ? void 0 : filters.search) {
                    query.$or = [
                        { endpoint: { $regex: filters.search, $options: 'i' } },
                        { 'metadata.description': { $regex: filters.search, $options: 'i' } }
                    ];
                }
                // Tarih aralığı filtresi
                if ((filters === null || filters === void 0 ? void 0 : filters.startDate) || (filters === null || filters === void 0 ? void 0 : filters.endDate)) {
                    query.requestTime = {};
                    if (filters.startDate)
                        query.requestTime.$gte = filters.startDate;
                    if (filters.endDate)
                        query.requestTime.$lte = filters.endDate;
                }
                const skip = (page - 1) * limit;
                const sortObj = {};
                sortObj[sortField] = sortOrder === 'asc' ? 1 : -1;
                const [logs, total] = yield Promise.all([
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
            }
            catch (error) {
                logger_service_1.logger.error('Error fetching user integration logs:', error);
                throw error;
            }
        });
    }
    /**
     * Admin için tüm entegrasyon loglarını getirir
     */
    getAllLogs(integrationName_1, userId_1) {
        return __awaiter(this, arguments, void 0, function* (integrationName, userId, page = 1, limit = 50, startDate, endDate) {
            try {
                const query = {};
                if (integrationName) {
                    query.integrationName = integrationName;
                }
                if (userId) {
                    query.userId = userId;
                }
                if (startDate || endDate) {
                    query.requestTime = {};
                    if (startDate)
                        query.requestTime.$gte = startDate;
                    if (endDate)
                        query.requestTime.$lte = endDate;
                }
                const skip = (page - 1) * limit;
                const [logs, total] = yield Promise.all([
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
            }
            catch (error) {
                logger_service_1.logger.error('Error fetching all integration logs:', error);
                throw error;
            }
        });
    }
    /**
     * Belirli bir log kaydının detayını getirir
     */
    getLogDetail(logId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = { _id: logId };
                // Admin değilse sadece kendi loglarını görebilir
                if (userId) {
                    query.userId = userId;
                }
                const log = yield this.IntegrationRequestLogModel.findOne(query).lean();
                if (!log) {
                    throw new Error('Integration log not found or access denied');
                }
                return log;
            }
            catch (error) {
                logger_service_1.logger.error('Error fetching integration log detail:', error);
                throw error;
            }
        });
    }
    /**
     * Belirtilen günden eski log kayıtlarını temizler (hard delete)
     */
    cleanupOldLogs() {
        return __awaiter(this, arguments, void 0, function* (retentionDays = 7) {
            try {
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
                logger_service_1.logger.info(`Starting cleanup of integration logs older than ${retentionDays} days (before ${cutoffDate.toISOString()})`);
                const result = yield this.IntegrationRequestLogModel.deleteMany({
                    requestTime: { $lt: cutoffDate }
                });
                const deletedCount = result.deletedCount || 0;
                const message = `Successfully deleted ${deletedCount} integration log entries older than ${retentionDays} days`;
                logger_service_1.logger.info(message, {
                    deletedCount,
                    retentionDays,
                    cutoffDate: cutoffDate.toISOString()
                });
                return {
                    deletedCount,
                    message
                };
            }
            catch (error) {
                logger_service_1.logger.error('Error during integration logs cleanup:', error);
                throw error;
            }
        });
    }
    /**
     * Admin için entegrasyon loglarını getirir (Admin route'lar için alias)
     */
    getAdminLogs(integrationName_1) {
        return __awaiter(this, arguments, void 0, function* (integrationName, page = 1, limit = 50, sortField = 'requestTime', sortOrder = 'desc', filters) {
            try {
                const query = {};
                if (integrationName) {
                    query.integrationName = integrationName;
                }
                if (filters === null || filters === void 0 ? void 0 : filters.userId) {
                    query.userId = filters.userId;
                }
                if (filters === null || filters === void 0 ? void 0 : filters.method) {
                    query.method = filters.method;
                }
                if ((filters === null || filters === void 0 ? void 0 : filters.success) !== undefined) {
                    // Success is a virtual field, filter by responseStatus instead
                    if (filters.success) {
                        query.responseStatus = { $gte: 200, $lt: 300 };
                    }
                    else {
                        query.$or = [
                            { responseStatus: { $exists: false } },
                            { responseStatus: { $lt: 200 } },
                            { responseStatus: { $gte: 300 } }
                        ];
                    }
                }
                if (filters === null || filters === void 0 ? void 0 : filters.search) {
                    query.$or = [
                        { endpoint: { $regex: filters.search, $options: 'i' } },
                        { 'metadata.description': { $regex: filters.search, $options: 'i' } }
                    ];
                }
                const skip = (page - 1) * limit;
                const sortObj = {};
                sortObj[sortField] = sortOrder === 'asc' ? 1 : -1;
                const [logs, total] = yield Promise.all([
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
            }
            catch (error) {
                logger_service_1.logger.error('Error fetching admin integration logs:', error);
                throw error;
            }
        });
    }
    /**
     * Log detayını getirir (ID bazlı, alias metod)
     */
    getLogById(logId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getLogDetail(logId, userId);
        });
    }
    /**
     * Belirtilen ID'lerdeki logları siler (bulk delete)
     */
    deleteLogs(logIds, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = { _id: { $in: logIds } };
                // Admin değilse sadece kendi loglarını silebilir
                if (userId) {
                    query.userId = userId;
                }
                const result = yield this.IntegrationRequestLogModel.deleteMany(query);
                const deletedCount = result.deletedCount || 0;
                const message = `Successfully deleted ${deletedCount} integration log entries`;
                logger_service_1.logger.info(message, {
                    deletedCount,
                    requestedIds: logIds.length,
                    userId
                });
                return {
                    deletedCount,
                    message
                };
            }
            catch (error) {
                logger_service_1.logger.error('Error deleting integration logs:', error);
                throw error;
            }
        });
    }
    /**
     * Belirtilen tarih aralığı ve entegrasyon bazında logları siler
     */
    deleteLogsByDateAndIntegration(integrationName, startDate, endDate, retentionDays) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = { integrationName };
                if (retentionDays) {
                    const cutoffDate = new Date();
                    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
                    query.requestTime = { $lt: cutoffDate };
                }
                else if (startDate || endDate) {
                    query.requestTime = {};
                    if (startDate)
                        query.requestTime.$gte = startDate;
                    if (endDate)
                        query.requestTime.$lte = endDate;
                }
                const result = yield this.IntegrationRequestLogModel.deleteMany(query);
                const deletedCount = result.deletedCount || 0;
                const message = `Successfully deleted ${deletedCount} ${integrationName} integration log entries`;
                logger_service_1.logger.info(message, {
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
            }
            catch (error) {
                logger_service_1.logger.error('Error deleting integration logs by date and integration:', error);
                throw error;
            }
        });
    }
    /**
     * Entegrasyon bazında log istatistiklerini getirir
     */
    getLogStatistics(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = {};
                if (userId) {
                    query.userId = userId;
                }
                // Bugün için tarih aralığı oluştur (gün başlangıcından itibaren)
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                // Bugünkü loglar için query
                const todayQuery = Object.assign(Object.assign({}, query), { requestTime: { $gte: today } });
                const [totalLogs, byIntegrationStats, oldestLog, newestLog, sizeStats, averageResponseTimeStats, todayLogsCount] = yield Promise.all([
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
                        { $match: Object.assign(Object.assign({}, query), { duration: { $exists: true, $ne: null } }) },
                        {
                            $group: {
                                _id: null,
                                averageDuration: { $avg: '$duration' }
                            }
                        }
                    ]),
                    this.IntegrationRequestLogModel.countDocuments(todayQuery)
                ]);
                const byIntegration = {};
                byIntegrationStats.forEach((stat) => {
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
                    oldestLog: oldestLog === null || oldestLog === void 0 ? void 0 : oldestLog.requestTime,
                    newestLog: newestLog === null || newestLog === void 0 ? void 0 : newestLog.requestTime,
                    sizeEstimateKB,
                    totalSize,
                    averageResponseTime,
                    todayLogsCount
                };
            }
            catch (error) {
                logger_service_1.logger.error('Error fetching integration log statistics:', error);
                throw error;
            }
        });
    }
    /**
     * Request header'larındaki hassas bilgileri temizler
     */
    static sanitizeHeaders(headers) {
        const sanitized = Object.assign({}, headers);
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
     * JSON body'yi pretty-print formatına dönüştürür (okunabilir hale getirir)
     * String ise parse edip tekrar format eder
     * MongoDB'de string olarak saklanır
     */
    static formatBodyForStorage(body) {
        if (!body)
            return null;
        // Eğer zaten string ise JSON parse etmeye çalış
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            }
            catch (_a) {
                // Parse edilemiyorsa olduğu gibi döndür
                return body;
            }
        }
        // Object ise pretty-print JSON olarak döndür (2 space indentation)
        if (typeof body === 'object') {
            try {
                return JSON.stringify(body, null, 2);
            }
            catch (_b) {
                // Stringify edilemiyorsa toString kullan
                return String(body);
            }
        }
        return body;
    }
    /**
     * Request body'deki hassas bilgileri temizler ve pretty-print formatına dönüştürür
     * MongoDB'de string olarak saklanır
     */
    static sanitizeRequestBody(body) {
        if (!body || typeof body !== 'object')
            return this.formatBodyForStorage(body);
        const sanitized = JSON.parse(JSON.stringify(body));
        const sensitiveKeys = ['password', 'token', 'secret', 'key', 'access_token'];
        this.recursiveSanitize(sanitized, sensitiveKeys);
        // Pretty-print format
        return this.formatBodyForStorage(sanitized);
    }
    /**
     * Response body'deki hassas bilgileri temizler ve pretty-print formatına dönüştürür
     * MongoDB'de string olarak saklanır
     */
    static sanitizeResponseBody(body) {
        if (!body || typeof body !== 'object')
            return this.formatBodyForStorage(body);
        const sanitized = JSON.parse(JSON.stringify(body));
        const sensitiveKeys = ['password', 'token', 'secret', 'key', 'access_token'];
        this.recursiveSanitize(sanitized, sensitiveKeys);
        // Pretty-print format
        return this.formatBodyForStorage(sanitized);
    }
    /**
     * Nested objelerde hassas bilgileri temizler
     */
    static recursiveSanitize(obj, sensitiveKeys) {
        if (typeof obj !== 'object' || obj === null)
            return;
        for (const key in obj) {
            if (sensitiveKeys.includes(key.toLowerCase())) {
                obj[key] = '***REDACTED***';
            }
            else if (typeof obj[key] === 'object') {
                this.recursiveSanitize(obj[key], sensitiveKeys);
            }
        }
    }
}
exports.IntegrationRequestLogService = IntegrationRequestLogService;
