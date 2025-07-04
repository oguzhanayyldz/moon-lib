import mongoose from 'mongoose';
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
    options?: any;
    resumeToken?: any;
    connection?: mongoose.Connection;
}
export interface ChangeEventHandler {
    (change: any): Promise<void>;
}
export interface WatcherConfig {
    collectionName: string;
    pipeline?: mongoose.PipelineStage[];
    options?: any;
    eventHandler: ChangeEventHandler;
    errorHandler?: (error: any) => void;
    connection?: mongoose.Connection;
}
export declare abstract class BaseChangeStreamManager {
    protected watchers: Map<string, any>;
    protected isInitialized: boolean;
    protected connection: mongoose.Connection;
    constructor(connection?: mongoose.Connection);
    /**
     * Initialize change streams - to be implemented by subclasses
     */
    abstract initialize(): Promise<void>;
    /**
     * Start watching a collection with custom handler
     * This is the generic method that services should use
     */
    startWatching(config: WatcherConfig): Promise<string>;
    /**
     * Stop a specific change stream watcher
     */
    stopWatcher(watchId: string): Promise<void>;
    /**
     * Stop all change stream watchers
     */
    stopAll(): Promise<void>;
    /**
     * Get status of all watchers
     */
    getStatus(): {
        initialized: boolean;
        activeWatchers: string[];
        watcherCount: number;
        connection: {
            name: string;
            readyState: mongoose.ConnectionStates;
            host: string;
            port: number;
        };
    };
    /**
     * Check if manager is initialized
     */
    get initialized(): boolean;
    /**
     * Get connection info
     */
    get connectionInfo(): {
        name: string;
        readyState: mongoose.ConnectionStates;
        host: string;
        port: number;
    };
    /**
     * Helper method to create common pipelines
     */
    protected createUpdatePipeline(fieldNames: string[]): mongoose.PipelineStage[];
    /**
     * Helper method to create insert/update/delete pipeline
     */
    protected createCRUDPipeline(): mongoose.PipelineStage[];
}
/**
 * Default ChangeStreamManager that extends BaseChangeStreamManager
 * This maintains backward compatibility while encouraging service-specific implementations
 */
export declare class ChangeStreamManager extends BaseChangeStreamManager {
    private static instance;
    private constructor();
    static getInstance(connection?: mongoose.Connection): ChangeStreamManager;
    /**
     * Basic initialization - services should override this
     */
    initialize(): Promise<void>;
    /**
     * Legacy method - deprecated in favor of service-specific implementations
     * @deprecated Use service-specific change stream managers instead
     */
    startInventoryMonitoring(collectionName?: string): Promise<string>;
    /**
     * Legacy method - deprecated in favor of service-specific implementations
     * @deprecated Use service-specific change stream managers instead
     */
    startOrderStatusMonitoring(collectionName?: string): Promise<string>;
    /**
     * Legacy method - deprecated in favor of service-specific implementations
     * @deprecated Use service-specific change stream managers instead
     */
    startPriceMonitoring(collectionName?: string): Promise<string>;
}
export declare const changeStreamManager: ChangeStreamManager;
