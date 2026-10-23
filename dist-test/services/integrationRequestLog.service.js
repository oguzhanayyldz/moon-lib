"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationRequestLogService = exports.INTEGRATION_LOG_LIST_PROJECTION = exports.INTEGRATION_LOG_BODY_MAX_BYTES = void 0;
exports.withIntegrationLogSizes = withIntegrationLogSizes;
const interpreter_factory_1 = require("./response-interpreters/interpreter.factory");
const logger_service_1 = require("./logger.service");
const logSafety_util_1 = require("../utils/logSafety.util");
const integrationRequestLogPolicy_util_1 = require("../utils/integrationRequestLogPolicy.util");
/** Loga yazılan istek/yanıt gövdesinin üst sınırı (UTF-8 bayt, UC-962). */
exports.INTEGRATION_LOG_BODY_MAX_BYTES = 64 * 1024;
/**
 * Liste uçlarının projeksiyonu (UC-979): gövde ve header'lar listede taşınmaz (sayfa başına 50 × 64 KB);
 * detay ucu (`getLogDetail`) tam kaydı döner. Boyutlar `requestBytes`/`responseBytes` alanlarından gelir.
 */
exports.INTEGRATION_LOG_LIST_PROJECTION = {
    requestBody: 0,
    responseBody: 0,
    requestHeaders: 0,
    responseHeaders: 0,
    searchKeys: 0
};
/**
 * Liste satırına boyut alanlarını ekler (rotaların eski gövde ölçümü yerine). UC-979 öncesi kayıtlarda
 * bayt alanı yoktur: boyut null döner (istemci "-" gösterir; bu kayıtlar en geç 7 günde silinir).
 */
function withIntegrationLogSizes(log) {
    const requestSize = typeof log.requestBytes === 'number' ? log.requestBytes : null;
    const responseSize = typeof log.responseBytes === 'number' ? log.responseBytes : null;
    const totalSize = requestSize === null && responseSize === null ? null : (requestSize !== null && requestSize !== void 0 ? requestSize : 0) + (responseSize !== null && responseSize !== void 0 ? responseSize : 0);
    return Object.assign(Object.assign({}, log), { requestSize, responseSize, totalSize });
}
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
    async logRequest(options) {
        try {
            const requestTime = new Date();
            // Hassas bilgileri temizle
            const sanitizedHeaders = IntegrationRequestLogService.sanitizeHeaders(options.requestHeaders || {});
            const sanitizedBody = IntegrationRequestLogService.sanitizeRequestBody(options.requestBody || {});
            const logData = {
                integrationName: options.integrationName,
                userId: options.userId,
                operationType: options.operationType,
                method: options.method,
                endpoint: options.endpoint,
                requestHeaders: sanitizedHeaders,
                requestBody: sanitizedBody,
                requestTime,
                // UC-979: yanıt gelmezse (zaman aşımı, süreç çökmesi) kayıt hata sayılır; logResponse kesin süreyi yazar
                expireAt: (0, integrationRequestLogPolicy_util_1.computeLogExpireAt)(requestTime, false),
                // Kimlikler ham gövdeden: maskeli/kırpılmış gövdede eksik kalabilirler
                searchKeys: (0, integrationRequestLogPolicy_util_1.extractLogSearchKeys)({ endpoint: options.endpoint, requestBody: options.requestBody }),
                requestBytes: (0, integrationRequestLogPolicy_util_1.measureBodyBytes)(options.requestBody),
                metadata: options.metadata
            };
            const logEntry = new this.IntegrationRequestLogModel(logData);
            await logEntry.save();
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
    async logResponse(logId, options) {
        var _a, _b, _c;
        try {
            const responseTime = new Date();
            // Hassas bilgileri temizle
            const sanitizedResponseHeaders = IntegrationRequestLogService.sanitizeHeaders(options.responseHeaders || {});
            const logEntry = await this.IntegrationRequestLogModel.findById(logId);
            if (!logEntry) {
                logger_service_1.logger.warn(`Integration request log not found for ID: ${logId}`);
                return;
            }
            // Use provided duration if available (real HTTP request duration)
            // Otherwise calculate from timestamps (backward compatibility)
            const duration = (_a = options.duration) !== null && _a !== void 0 ? _a : (responseTime.getTime() - logEntry.requestTime.getTime());
            // Metadata'yı da kaydet (rate limit bilgileri vs.)
            const responseBytes = (0, integrationRequestLogPolicy_util_1.measureBodyBytes)(options.responseBody);
            const updateData = {
                responseStatus: options.responseStatus,
                responseHeaders: sanitizedResponseHeaders,
                errorMessage: options.errorMessage,
                duration,
                responseTime,
                responseBytes
            };
            // Gövde sanitize'ı WAF önizlemesi ve tam saklama için gerekli; başarılı okumada hiç üretilmez
            let sanitizedBodyCache;
            const sanitizedResponseBody = () => sanitizedBodyCache !== null && sanitizedBodyCache !== void 0 ? sanitizedBodyCache : (sanitizedBodyCache = IntegrationRequestLogService.sanitizeResponseBody(options.responseBody || {}));
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
                    };
                    logger_service_1.logger.debug('Response marked as blocked (WAF/engelleme), skipping platform interpreter', {
                        logId,
                        operationType: logEntry.operationType,
                        responseStatus: options.responseStatus
                    });
                }
                else {
                    try {
                        const interpreter = interpreter_factory_1.ResponseInterpreterFactory.getInterpreter(logEntry.integrationName);
                        if (interpreter) {
                            const interpretedResponse = interpreter.interpret(options.responseBody, logEntry.operationType);
                            if (interpretedResponse) {
                                // Yorumlayıcılar müşteri alanlarını details'e kopyalayabilir (T-Soft UPDATE_ORDER)
                                updateData.interpretedResponse = (0, logSafety_util_1.redactPersonalData)(interpretedResponse);
                                logger_service_1.logger.debug('Response interpreted successfully', {
                                    logId,
                                    operationType: logEntry.operationType,
                                    summary: interpretedResponse.summary
                                });
                            }
                        }
                    }
                    catch (interpretError) {
                        logger_service_1.logger.warn('Failed to interpret response, continuing without interpretation', {
                            logId,
                            error: interpretError.message
                        });
                    }
                }
            }
            // UC-979 saklama politikası: sonucu sınıflandır, gövdeyi ya özetle ya tam sakla, süreyi ayarla
            const blocked = IntegrationRequestLogService.looksLikeBlockedResponse(options.responseStatus, options.responseBody);
            const success = (0, integrationRequestLogPolicy_util_1.isSuccessfulLogOutcome)({
                responseStatus: options.responseStatus,
                interpretedSuccess: (_b = updateData.interpretedResponse) === null || _b === void 0 ? void 0 : _b.success,
                blocked,
                errorMessage: options.errorMessage
            });
            let summaryIds;
            if (success && (0, integrationRequestLogPolicy_util_1.isReadOperation)(logEntry.operationType) && (0, integrationRequestLogPolicy_util_1.isStructuredResponseBody)(options.responseBody)) {
                const summary = (0, integrationRequestLogPolicy_util_1.summarizeReadResponse)(logEntry.integrationName, options.responseBody, responseBytes);
                updateData.responseBody = null;
                updateData.responseSummary = summary;
                summaryIds = summary.ids;
            }
            else {
                updateData.responseBody = sanitizedResponseBody();
            }
            updateData.expireAt = (0, integrationRequestLogPolicy_util_1.computeLogExpireAt)(logEntry.requestTime, success);
            if (options.responseStatus === 409 && IntegrationRequestLogService.bodyReportsSuccess(options.responseBody)) {
                updateData.idempotentSuccess = true;
            }
            const responseKeys = (0, integrationRequestLogPolicy_util_1.extractLogSearchKeys)({
                summaryIds,
                responseBody: summaryIds ? undefined : options.responseBody
            });
            if (responseKeys.length > 0) {
                updateData.searchKeys = Array.from(new Set([...((_c = logEntry.searchKeys) !== null && _c !== void 0 ? _c : []), ...responseKeys]))
                    .slice(0, integrationRequestLogPolicy_util_1.INTEGRATION_LOG_SEARCH_KEYS_MAX * 2);
            }
            await this.IntegrationRequestLogModel.findByIdAndUpdate(logId, updateData);
            logger_service_1.logger.debug(`Integration response logged`, {
                logId,
                responseStatus: options.responseStatus,
                duration,
                durationSource: options.duration ? 'caller' : 'calculated',
                hasError: !!options.errorMessage,
                hasInterpretation: !!updateData.interpretedResponse
            });
        }
        catch (error) {
            logger_service_1.logger.error('Error logging integration response:', error);
            throw error;
        }
    }
    /**
     * Kullanıcının entegrasyon loglarını getirir
     */
    async getUserLogs(userId, integrationName, page = 1, limit = 50, sortField = 'requestTime', sortOrder = 'desc', filters) {
        try {
            const query = { userId };
            if (integrationName) {
                query.integrationName = integrationName;
            }
            if (filters === null || filters === void 0 ? void 0 : filters.operationType) {
                query.operationType = filters.operationType;
            }
            if (filters === null || filters === void 0 ? void 0 : filters.method) {
                query.method = filters.method;
            }
            if ((filters === null || filters === void 0 ? void 0 : filters.success) !== undefined) {
                // Success is a virtual field, filter by responseStatus instead.
                // 207 (Multi-Status) kısmi başarıdır — ne "success" ne "failed" filtresine dahil,
                // ayrı "partial" değeriyle sorgulanır (batch toplu gönderim özet düzeltmesi — Parça 2).
                if (filters.success === 'partial') {
                    query.responseStatus = 207;
                }
                else if (filters.success) {
                    query.responseStatus = { $gte: 200, $lt: 300, $ne: 207 };
                }
                else {
                    // $or search filtresiyle aynı anahtarı ezmemesi için $and'e itiliyor (issue #877 ek bulgu 3)
                    query.$and = query.$and || [];
                    query.$and.push({
                        $or: [
                            { responseStatus: { $exists: false } },
                            { responseStatus: { $lt: 200 } },
                            { responseStatus: { $gte: 300 } }
                        ]
                    });
                }
            }
            if (filters === null || filters === void 0 ? void 0 : filters.search) {
                query.$and = query.$and || [];
                const escapedSearch = (0, logSafety_util_1.escapeRegExp)(filters.search);
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
            if ((filters === null || filters === void 0 ? void 0 : filters.advancedSearch) && filters.advancedSearch.trim()) {
                query.$and = query.$and || [];
                query.$and.push((0, integrationRequestLogPolicy_util_1.buildSearchKeysQuery)(filters.advancedSearch));
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
            const [logs, total] = await Promise.all([
                this.IntegrationRequestLogModel.find(query, exports.INTEGRATION_LOG_LIST_PROJECTION)
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
    }
    /**
     * Admin için tüm entegrasyon loglarını getirir
     */
    async getAllLogs(integrationName, userId, page = 1, limit = 50, startDate, endDate) {
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
            const [logs, total] = await Promise.all([
                this.IntegrationRequestLogModel.find(query, exports.INTEGRATION_LOG_LIST_PROJECTION)
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
    }
    /**
     * Belirli bir log kaydının detayını getirir
     */
    async getLogDetail(logId, userId) {
        try {
            const query = { _id: logId };
            // Admin değilse sadece kendi loglarını görebilir
            if (userId) {
                query.userId = userId;
            }
            const log = await this.IntegrationRequestLogModel.findOne(query).lean();
            if (!log) {
                throw new Error('Integration log not found or access denied');
            }
            return log;
        }
        catch (error) {
            logger_service_1.logger.error('Error fetching integration log detail:', error);
            throw error;
        }
    }
    /**
     * Belirtilen günden eski log kayıtlarını temizler (hard delete)
     */
    async cleanupOldLogs(retentionDays = 7) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
            logger_service_1.logger.info(`Starting cleanup of integration logs older than ${retentionDays} days (before ${cutoffDate.toISOString()})`);
            const result = await this.IntegrationRequestLogModel.deleteMany({
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
    }
    /**
     * Admin için entegrasyon loglarını getirir (Admin route'lar için alias)
     */
    async getAdminLogs(integrationName, page = 1, limit = 50, sortField = 'requestTime', sortOrder = 'desc', filters) {
        try {
            const query = {};
            if (integrationName) {
                query.integrationName = integrationName;
            }
            if (filters === null || filters === void 0 ? void 0 : filters.userId) {
                query.userId = filters.userId;
            }
            if (filters === null || filters === void 0 ? void 0 : filters.operationType) {
                query.operationType = filters.operationType;
            }
            if (filters === null || filters === void 0 ? void 0 : filters.method) {
                query.method = filters.method;
            }
            if ((filters === null || filters === void 0 ? void 0 : filters.success) !== undefined) {
                // Success is a virtual field, filter by responseStatus instead.
                // 207 (Multi-Status) kısmi başarıdır — ayrı "partial" değeriyle sorgulanır.
                if (filters.success === 'partial') {
                    query.responseStatus = 207;
                }
                else if (filters.success) {
                    query.responseStatus = { $gte: 200, $lt: 300, $ne: 207 };
                }
                else {
                    // $or search filtresiyle aynı anahtarı ezmemesi için $and'e itiliyor (issue #877 ek bulgu 3)
                    query.$and = query.$and || [];
                    query.$and.push({
                        $or: [
                            { responseStatus: { $exists: false } },
                            { responseStatus: { $lt: 200 } },
                            { responseStatus: { $gte: 300 } }
                        ]
                    });
                }
            }
            if (filters === null || filters === void 0 ? void 0 : filters.search) {
                const escapedSearch = (0, logSafety_util_1.escapeRegExp)(filters.search);
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
            if ((filters === null || filters === void 0 ? void 0 : filters.advancedSearch) && filters.advancedSearch.trim()) {
                query.$and = query.$and || [];
                query.$and.push((0, integrationRequestLogPolicy_util_1.buildSearchKeysQuery)(filters.advancedSearch));
            }
            const skip = (page - 1) * limit;
            const sortObj = {};
            sortObj[sortField] = sortOrder === 'asc' ? 1 : -1;
            const [logs, total] = await Promise.all([
                this.IntegrationRequestLogModel.find(query, exports.INTEGRATION_LOG_LIST_PROJECTION)
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
    }
    /**
     * Log detayını getirir (ID bazlı, alias metod)
     */
    async getLogById(logId, userId) {
        return this.getLogDetail(logId, userId);
    }
    /**
     * Belirtilen ID'lerdeki logları siler (bulk delete)
     */
    async deleteLogs(logIds, userId) {
        try {
            const query = { _id: { $in: logIds } };
            // Admin değilse sadece kendi loglarını silebilir
            if (userId) {
                query.userId = userId;
            }
            const result = await this.IntegrationRequestLogModel.deleteMany(query);
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
    }
    /**
     * Belirtilen tarih aralığı ve entegrasyon bazında logları siler
     */
    async deleteLogsByDateAndIntegration(integrationName, startDate, endDate, retentionDays) {
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
            const result = await this.IntegrationRequestLogModel.deleteMany(query);
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
    }
    /**
     * Entegrasyon bazında log istatistiklerini getirir
     */
    async getLogStatistics(userId) {
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
            const [totalLogs, byIntegrationStats, oldestLog, newestLog, sizeStats, averageResponseTimeStats, todayLogsCount] = await Promise.all([
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
    }
    /**
     * WAF/engelleme sayfası tespiti (TASK-MUDY1TB6EDJAJ): hata durum kodu + JSON olmayan
     * (tipik olarak HTML) bir gövde. Platform interpreter'larının "tanınmayan gövde" fallback'i
     * koşulsuz `success:true` döndüğünden, bu şekli interpreter'a hiç göndermiyoruz.
     */
    static looksLikeBlockedResponse(responseStatus, responseBody) {
        if (typeof responseBody !== 'string')
            return false;
        // Yalnız hata durum kodunda: 2xx düz metin gövdede "cloudflare" vb. geçmesi engelleme sayılmaz.
        return typeof responseStatus === 'number' && responseStatus >= 300;
    }
    /**
     * Header'lardaki kimlik bilgilerini temizler (n11 `appkey`/`appsecret`, HepsiJet `X-Auth-Token`,
     * `Authorization`, `Set-Cookie` …). Ad kuralı gövdeyle aynıdır: `isSensitiveFieldName`.
     */
    static sanitizeHeaders(headers) {
        const sanitized = Object.assign({}, headers);
        Object.keys(sanitized).forEach(headerKey => {
            if ((0, logSafety_util_1.isSensitiveFieldName)(headerKey)) {
                sanitized[headerKey] = logSafety_util_1.REDACTED_FIELD_MASK;
            }
        });
        return sanitized;
    }
    /**
     * JSON body'yi girintisiz JSON metnine dönüştürür (istemci görüntüleyicisi kendisi biçimlendirir)
     * String ise parse edip tekrar serileştirir
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
        // Object ise girintisiz (compact) JSON olarak döndür (UC-979: girinti gövdeyi ~%30 büyütüyordu)
        if (typeof body === 'object') {
            try {
                return JSON.stringify(body);
            }
            catch (_b) {
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
    static truncateForStorage(body) {
        if (typeof body !== 'string')
            return body;
        const totalBytes = Buffer.byteLength(body, 'utf8');
        if (totalBytes <= exports.INTEGRATION_LOG_BODY_MAX_BYTES)
            return body;
        const head = Buffer.from(body, 'utf8')
            .subarray(0, exports.INTEGRATION_LOG_BODY_MAX_BYTES)
            .toString('utf8')
            .replace(/�+$/, '');
        return `${head}\n…(kırpıldı, toplam ${totalBytes} bayt)`;
    }
    /**
     * Request body'deki kimlik ve kişisel veriyi maskeler, compact JSON'a dönüştürür ve sınırlar
     * MongoDB'de string olarak saklanır
     */
    static sanitizeRequestBody(body) {
        return this.truncateForStorage(this.formatBodyForStorage(this.redactBody(body)));
    }
    /**
     * Response body'deki kimlik ve kişisel veriyi maskeler, compact JSON'a dönüştürür ve sınırlar
     * MongoDB'de string olarak saklanır
     */
    static sanitizeResponseBody(body) {
        return this.truncateForStorage(this.formatBodyForStorage(this.redactBody(body)));
    }
    /**
     * Gövdedeki kimlik alanlarını maskeler (kural: `logSafety.util` → `isSensitiveFieldName`).
     *
     * - Nesne: kimlik adlı alanın değeri (tipi ne olursa olsun) maskelenir; diğer string değerler
     *   de taranır — `{ body: "pass=..." }` ya da `{ data: "<json>" }` gibi sarılı gövdeler için.
     * - String: JSON, XML/SOAP (`<tem:UyeKodu>` dahil) ya da URL-encoded olabilir; üçü de taranır.
     */
    static redactBody(body) {
        if (!body)
            return body;
        // UC-979: sır maskesinden sonra kişisel veri maskesi (ad, adres, telefon, e-posta, TCKN/VKN)
        if (typeof body === 'string')
            return (0, logSafety_util_1.redactPersonalData)((0, logSafety_util_1.redactSensitiveText)(body));
        if (typeof body !== 'object')
            return body;
        return (0, logSafety_util_1.redactPersonalData)((0, logSafety_util_1.redactSensitiveFields)(JSON.parse(JSON.stringify(body))));
    }
    /** 409 gövdesi `success: true` mı (idempotent işlem — istemci başarılı gösterir). */
    static bodyReportsSuccess(responseBody) {
        let parsed = responseBody;
        if (typeof responseBody === 'string') {
            try {
                parsed = JSON.parse(responseBody);
            }
            catch (_a) {
                return false;
            }
        }
        return !!parsed && typeof parsed === 'object' && parsed.success === true;
    }
}
exports.IntegrationRequestLogService = IntegrationRequestLogService;
//# sourceMappingURL=integrationRequestLog.service.js.map