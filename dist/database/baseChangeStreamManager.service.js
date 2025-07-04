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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changeStreamManager = exports.ChangeStreamManager = exports.BaseChangeStreamManager = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const logger_service_1 = require("../services/logger.service");
class BaseChangeStreamManager {
    constructor(connection) {
        this.watchers = new Map(); // ChangeStream type changed in mongoose v7
        this.isInitialized = false;
        // Use provided connection or default to mongoose.connection
        this.connection = connection || mongoose_1.default.connection;
    }
    /**
     * Start watching a collection with custom handler
     * This is the generic method that services should use
     */
    startWatching(config) {
        return __awaiter(this, void 0, void 0, function* () {
            const { collectionName, pipeline = [], options = {}, eventHandler, errorHandler } = config;
            const watchId = `${collectionName}_${Date.now()}`;
            const connection = config.connection || this.connection;
            try {
                logger_service_1.logger.info(`🔄 Starting change stream watcher - Collection: ${collectionName}, Watch ID: ${watchId}`);
                // Check if connection is ready
                if (connection.readyState !== 1) {
                    throw new Error(`MongoDB connection not ready. State: ${connection.readyState} (0=disconnected, 1=connected, 2=connecting, 3=disconnecting)`);
                }
                // Get database from connection
                const db = connection.db;
                if (!db) {
                    throw new Error(`Database not available on connection: ${connection.name || 'undefined'}`);
                }
                // Create change stream
                const changeStream = db.collection(collectionName).watch(pipeline, Object.assign({ fullDocument: 'updateLookup' }, options));
                // Handle change events
                changeStream.on('change', (change) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        yield eventHandler(change);
                    }
                    catch (error) {
                        logger_service_1.logger.error(`Change event handler error for ${collectionName}:`, error);
                        if (errorHandler) {
                            errorHandler(error);
                        }
                    }
                }));
                // Handle errors and reconnection
                changeStream.on('error', (error) => {
                    logger_service_1.logger.error(`Change stream error for ${collectionName}:`, error);
                    if (errorHandler) {
                        errorHandler(error);
                    }
                    else {
                        // Default: attempt to restart the stream after delay
                        setTimeout(() => {
                            logger_service_1.logger.info(`Attempting to restart change stream for ${collectionName}...`);
                            this.startWatching(config).catch((error) => {
                                logger_service_1.logger.error(`Failed to restart change stream for ${collectionName}:`, error);
                                // No further errorHandler call here since it's already undefined in this branch
                            });
                        }, 5000);
                    }
                });
                // Store watcher reference
                this.watchers.set(watchId, changeStream);
                logger_service_1.logger.info(`✅ Change stream watcher started successfully - Collection: ${collectionName}, Watch ID: ${watchId}`);
                return watchId;
            }
            catch (error) {
                logger_service_1.logger.error(`Failed to start change stream watcher for ${collectionName}:`, error);
                throw error;
            }
        });
    }
    /**
     * Stop a specific change stream watcher
     */
    stopWatcher(watchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const watcher = this.watchers.get(watchId);
            if (watcher) {
                try {
                    yield watcher.close();
                    this.watchers.delete(watchId);
                    logger_service_1.logger.info(`🛑 Change stream watcher stopped - ID: ${watchId}`);
                }
                catch (error) {
                    logger_service_1.logger.error(`Failed to stop watcher ${watchId}:`, error);
                }
            }
            else {
                logger_service_1.logger.warn(`Watcher not found for ID: ${watchId}`);
            }
        });
    }
    /**
     * Stop all change stream watchers
     */
    stopAll() {
        return __awaiter(this, void 0, void 0, function* () {
            logger_service_1.logger.info('🛑 Stopping all change stream watchers...');
            const stopPromises = [];
            for (const [watchId, watcher] of this.watchers) {
                stopPromises.push(watcher.close()
                    .then(() => logger_service_1.logger.info(`✅ Stopped watcher: ${watchId}`))
                    .catch((error) => logger_service_1.logger.error(`Failed to stop watcher ${watchId}:`, error)));
            }
            yield Promise.allSettled(stopPromises);
            this.watchers.clear();
            this.isInitialized = false;
            logger_service_1.logger.info('✅ All change stream watchers stopped');
        });
    }
    /**
     * Get status of all watchers
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            activeWatchers: Array.from(this.watchers.keys()),
            watcherCount: this.watchers.size,
            connection: {
                name: this.connection.name,
                readyState: this.connection.readyState,
                host: this.connection.host,
                port: this.connection.port
            }
        };
    }
    /**
     * Check if manager is initialized
     */
    get initialized() {
        return this.isInitialized;
    }
    /**
     * Get connection info
     */
    get connectionInfo() {
        return {
            name: this.connection.name,
            readyState: this.connection.readyState,
            host: this.connection.host,
            port: this.connection.port
        };
    }
    /**
     * Helper method to create common pipelines
     */
    createUpdatePipeline(fieldNames) {
        const fieldConditions = fieldNames.map(field => ({
            [`updateDescription.updatedFields.${field}`]: { $exists: true }
        }));
        return [
            {
                $match: {
                    operationType: { $in: ['update', 'replace'] },
                    $or: fieldConditions
                }
            }
        ];
    }
    /**
     * Helper method to create insert/update/delete pipeline
     */
    createCRUDPipeline() {
        return [
            {
                $match: {
                    operationType: { $in: ['insert', 'update', 'replace', 'delete'] }
                }
            }
        ];
    }
}
exports.BaseChangeStreamManager = BaseChangeStreamManager;
/**
 * Default ChangeStreamManager that extends BaseChangeStreamManager
 * This maintains backward compatibility while encouraging service-specific implementations
 */
class ChangeStreamManager extends BaseChangeStreamManager {
    constructor(connection) {
        super(connection);
    }
    static getInstance(connection) {
        if (!ChangeStreamManager.instance) {
            ChangeStreamManager.instance = new ChangeStreamManager(connection);
        }
        return ChangeStreamManager.instance;
    }
    /**
     * Basic initialization - services should override this
     */
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isInitialized) {
                logger_service_1.logger.warn('ChangeStreamManager already initialized');
                return;
            }
            logger_service_1.logger.info('🔄 Initializing Base Change Stream Manager...');
            // No default watchers - services should set up their own
            this.isInitialized = true;
            logger_service_1.logger.info('✅ Base Change Stream Manager initialized (no default watchers)');
            logger_service_1.logger.info('💡 Services should extend BaseChangeStreamManager for specific business logic');
        });
    }
    /**
     * Legacy method - deprecated in favor of service-specific implementations
     * @deprecated Use service-specific change stream managers instead
     */
    startInventoryMonitoring() {
        return __awaiter(this, arguments, void 0, function* (collectionName = 'productstocks') {
            logger_service_1.logger.warn('⚠️ DEPRECATED: startInventoryMonitoring should be implemented in inventory service');
            return yield this.startWatching({
                collectionName,
                pipeline: this.createUpdatePipeline(['availableStock', 'reservedStock']),
                eventHandler: (change) => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    logger_service_1.logger.info(`📦 Inventory change detected - Collection: ${collectionName}`, {
                        operationType: change.operationType,
                        documentId: (_a = change.fullDocument) === null || _a === void 0 ? void 0 : _a._id
                    });
                    // No business logic - just logging
                })
            });
        });
    }
    /**
     * Legacy method - deprecated in favor of service-specific implementations
     * @deprecated Use service-specific change stream managers instead
     */
    startOrderStatusMonitoring() {
        return __awaiter(this, arguments, void 0, function* (collectionName = 'orders') {
            logger_service_1.logger.warn('⚠️ DEPRECATED: startOrderStatusMonitoring should be implemented in orders service');
            return yield this.startWatching({
                collectionName,
                pipeline: this.createUpdatePipeline(['status']),
                eventHandler: (change) => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    logger_service_1.logger.info(`📋 Order change detected - Collection: ${collectionName}`, {
                        operationType: change.operationType,
                        documentId: (_a = change.fullDocument) === null || _a === void 0 ? void 0 : _a._id
                    });
                    // No business logic - just logging
                })
            });
        });
    }
    /**
     * Legacy method - deprecated in favor of service-specific implementations
     * @deprecated Use service-specific change stream managers instead
     */
    startPriceMonitoring() {
        return __awaiter(this, arguments, void 0, function* (collectionName = 'prices') {
            logger_service_1.logger.warn('⚠️ DEPRECATED: startPriceMonitoring should be implemented in pricing service');
            return yield this.startWatching({
                collectionName,
                pipeline: this.createUpdatePipeline(['price', 'salePrice', 'listPrice']),
                eventHandler: (change) => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    logger_service_1.logger.info(`💰 Price change detected - Collection: ${collectionName}`, {
                        operationType: change.operationType,
                        documentId: (_a = change.fullDocument) === null || _a === void 0 ? void 0 : _a._id
                    });
                    // No business logic - just logging
                })
            });
        });
    }
}
exports.ChangeStreamManager = ChangeStreamManager;
// Export singleton instance for backward compatibility
exports.changeStreamManager = ChangeStreamManager.getInstance();
