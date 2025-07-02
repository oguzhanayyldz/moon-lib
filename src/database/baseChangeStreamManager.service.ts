import mongoose from 'mongoose';
import { logger } from '../services/logger.service';

/**
 * Base MongoDB Atlas Change Streams Manager
 * 
 * This is a generic change stream framework for MongoDB Atlas that provides:
 * - Service-agnostic change stream monitoring
 * - Pluggable event handler system
 * - Connection injection support
 * - No business logic - purely infrastructure
 * 
 * Services should extend this class to implement their specific business logic.
 */

export interface ChangeStreamConfig {
    pipeline?: mongoose.PipelineStage[];
    options?: mongoose.ChangeStreamOptions;
    resumeToken?: mongoose.ResumeToken;
    connection?: mongoose.Connection;
}

export interface ChangeEventHandler {
    (change: any): Promise<void>;
}

export interface WatcherConfig {
    collectionName: string;
    pipeline?: mongoose.PipelineStage[];
    options?: mongoose.ChangeStreamOptions;
    eventHandler: ChangeEventHandler;
    errorHandler?: (error: any) => void;
    connection?: mongoose.Connection;
}

export abstract class BaseChangeStreamManager {
    protected watchers: Map<string, mongoose.ChangeStream> = new Map();
    protected isInitialized: boolean = false;
    protected connection: mongoose.Connection;

    constructor(connection?: mongoose.Connection) {
        // Use provided connection or default to mongoose.connection
        this.connection = connection || mongoose.connection;
    }

    /**
     * Initialize change streams - to be implemented by subclasses
     */
    abstract initialize(): Promise<void>;

    /**
     * Start watching a collection with custom handler
     * This is the generic method that services should use
     */
    async startWatching(config: WatcherConfig): Promise<string> {
        const { collectionName, pipeline = [], options = {}, eventHandler, errorHandler } = config;
        const watchId = `${collectionName}_${Date.now()}`;
        const connection = config.connection || this.connection;
        
        try {
            logger.info(`🔄 Starting change stream watcher - Collection: ${collectionName}, Watch ID: ${watchId}`);

            // Get database from connection
            const db = connection.db;
            if (!db) {
                throw new Error(`Database not available on connection: ${connection.name}`);
            }

            // Create change stream
            const changeStream = db.collection(collectionName).watch(pipeline, {
                fullDocument: 'updateLookup',
                ...options
            });

            // Handle change events
            changeStream.on('change', async (change: any) => {
                try {
                    await eventHandler(change);
                } catch (error) {
                    logger.error(`Change event handler error for ${collectionName}:`, error);
                    if (errorHandler) {
                        errorHandler(error);
                    }
                }
            });

            // Handle errors and reconnection
            changeStream.on('error', (error) => {
                logger.error(`Change stream error for ${collectionName}:`, error);
                
                if (errorHandler) {
                    errorHandler(error);
                } else {
                    // Default: attempt to restart the stream after delay
                    setTimeout(() => {
                        logger.info(`Attempting to restart change stream for ${collectionName}...`);
                        this.startWatching(config).catch((error) => {
                            logger.error(`Failed to restart change stream for ${collectionName}:`, error);
                            if (errorHandler) {
                                errorHandler(error);
                            }
                        });
                    }, 5000);
                }
            });

            // Store watcher reference
            this.watchers.set(watchId, changeStream);
            
            logger.info(`✅ Change stream watcher started successfully - Collection: ${collectionName}, Watch ID: ${watchId}`);
            
            return watchId;
        } catch (error) {
            logger.error(`Failed to start change stream watcher for ${collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Stop a specific change stream watcher
     */
    async stopWatcher(watchId: string): Promise<void> {
        const watcher = this.watchers.get(watchId);
        if (watcher) {
            try {
                await watcher.close();
                this.watchers.delete(watchId);
                logger.info(`🛑 Change stream watcher stopped - ID: ${watchId}`);
            } catch (error) {
                logger.error(`Failed to stop watcher ${watchId}:`, error);
            }
        } else {
            logger.warn(`Watcher not found for ID: ${watchId}`);
        }
    }

    /**
     * Stop all change stream watchers
     */
    async stopAll(): Promise<void> {
        logger.info('🛑 Stopping all change stream watchers...');
        
        const stopPromises = [];
        for (const [watchId, watcher] of this.watchers) {
            stopPromises.push(
                watcher.close()
                    .then(() => logger.info(`✅ Stopped watcher: ${watchId}`))
                    .catch((error) => logger.error(`Failed to stop watcher ${watchId}:`, error))
            );
        }
        
        await Promise.allSettled(stopPromises);
        
        this.watchers.clear();
        this.isInitialized = false;
        logger.info('✅ All change stream watchers stopped');
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
    get initialized(): boolean {
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
    protected createUpdatePipeline(fieldNames: string[]): mongoose.PipelineStage[] {
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
    protected createCRUDPipeline(): mongoose.PipelineStage[] {
        return [
            {
                $match: {
                    operationType: { $in: ['insert', 'update', 'replace', 'delete'] }
                }
            }
        ];
    }
}

/**
 * Default ChangeStreamManager that extends BaseChangeStreamManager
 * This maintains backward compatibility while encouraging service-specific implementations
 */
export class ChangeStreamManager extends BaseChangeStreamManager {
    private static instance: ChangeStreamManager;

    private constructor(connection?: mongoose.Connection) {
        super(connection);
    }

    public static getInstance(connection?: mongoose.Connection): ChangeStreamManager {
        if (!ChangeStreamManager.instance) {
            ChangeStreamManager.instance = new ChangeStreamManager(connection);
        }
        return ChangeStreamManager.instance;
    }

    /**
     * Basic initialization - services should override this
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            logger.warn('ChangeStreamManager already initialized');
            return;
        }

        logger.info('🔄 Initializing Base Change Stream Manager...');
        
        // No default watchers - services should set up their own
        this.isInitialized = true;
        
        logger.info('✅ Base Change Stream Manager initialized (no default watchers)');
        logger.info('💡 Services should extend BaseChangeStreamManager for specific business logic');
    }

    /**
     * Legacy method - deprecated in favor of service-specific implementations
     * @deprecated Use service-specific change stream managers instead
     */
    async startInventoryMonitoring(collectionName: string = 'productstocks'): Promise<string> {
        logger.warn('⚠️ DEPRECATED: startInventoryMonitoring should be implemented in inventory service');
        
        return await this.startWatching({
            collectionName,
            pipeline: this.createUpdatePipeline(['availableStock', 'reservedStock']),
            eventHandler: async (change) => {
                logger.info(`📦 Inventory change detected - Collection: ${collectionName}`, {
                    operationType: change.operationType,
                    documentId: change.fullDocument?._id
                });
                // No business logic - just logging
            }
        });
    }

    /**
     * Legacy method - deprecated in favor of service-specific implementations
     * @deprecated Use service-specific change stream managers instead
     */
    async startOrderStatusMonitoring(collectionName: string = 'orders'): Promise<string> {
        logger.warn('⚠️ DEPRECATED: startOrderStatusMonitoring should be implemented in orders service');
        
        return await this.startWatching({
            collectionName,
            pipeline: this.createUpdatePipeline(['status']),
            eventHandler: async (change) => {
                logger.info(`📋 Order change detected - Collection: ${collectionName}`, {
                    operationType: change.operationType,
                    documentId: change.fullDocument?._id
                });
                // No business logic - just logging
            }
        });
    }

    /**
     * Legacy method - deprecated in favor of service-specific implementations
     * @deprecated Use service-specific change stream managers instead
     */
    async startPriceMonitoring(collectionName: string = 'prices'): Promise<string> {
        logger.warn('⚠️ DEPRECATED: startPriceMonitoring should be implemented in pricing service');
        
        return await this.startWatching({
            collectionName,
            pipeline: this.createUpdatePipeline(['price', 'salePrice', 'listPrice']),
            eventHandler: async (change) => {
                logger.info(`💰 Price change detected - Collection: ${collectionName}`, {
                    operationType: change.operationType,
                    documentId: change.fullDocument?._id
                });
                // No business logic - just logging
            }
        });
    }
}

// Export singleton instance for backward compatibility
export const changeStreamManager = ChangeStreamManager.getInstance();