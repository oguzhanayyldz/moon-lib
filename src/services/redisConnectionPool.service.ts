/**
 * Redis Connection Pool Service
 * 
 * Provides optimized Redis connection pooling for improved performance
 * in security middleware and rate limiting operations.
 */

import Redis from 'ioredis';

export interface RedisPoolConfig {
    host: string;
    port: number;
    password?: string;
    db?: number;
    maxConnections: number;
    minConnections: number;
    acquireTimeoutMs: number;
    idleTimeoutMs: number;
    maxRetries: number;
    retryDelayOnFailover: number;
    lazyConnect: boolean;
    keepAlive: number;
    maxRetriesPerRequest: number;
}

export interface PoolStats {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    pendingAcquires: number;
    totalAcquired: number;
    totalReleased: number;
    totalCreated: number;
    totalDestroyed: number;
    totalFailed: number;
}

class RedisConnectionPool {
    private pool: Redis[];
    private activeConnections: Set<Redis>;
    private idleConnections: Set<Redis>;
    private pendingAcquires: Array<{
        resolve: (connection: Redis) => void;
        reject: (error: Error) => void;
        timestamp: number;
    }>;
    private config: RedisPoolConfig;
    private stats: PoolStats;
    private cleanupInterval?: NodeJS.Timeout;
    private healthCheckInterval?: NodeJS.Timeout;

    constructor(config: Partial<RedisPoolConfig> = {}) {
        this.config = {
            host: config.host || process.env.REDIS_HOST || 'localhost',
            port: config.port || parseInt(process.env.REDIS_PORT || '6379'),
            password: config.password || process.env.REDIS_PASSWORD,
            db: config.db || parseInt(process.env.REDIS_DB || '0'),
            maxConnections: config.maxConnections || 20,
            minConnections: config.minConnections || 5,
            acquireTimeoutMs: config.acquireTimeoutMs || 5000,
            idleTimeoutMs: config.idleTimeoutMs || 30000,
            maxRetries: config.maxRetries || 3,
            retryDelayOnFailover: config.retryDelayOnFailover || 100,
            lazyConnect: config.lazyConnect !== false,
            keepAlive: config.keepAlive || 30000,
            maxRetriesPerRequest: config.maxRetriesPerRequest || 3
        };

        this.pool = [];
        this.activeConnections = new Set();
        this.idleConnections = new Set();
        this.pendingAcquires = [];
        
        this.stats = {
            totalConnections: 0,
            activeConnections: 0,
            idleConnections: 0,
            pendingAcquires: 0,
            totalAcquired: 0,
            totalReleased: 0,
            totalCreated: 0,
            totalDestroyed: 0,
            totalFailed: 0
        };

        this.initialize();
    }

    private async initialize(): Promise<void> {
        // Create minimum number of connections
        for (let i = 0; i < this.config.minConnections; i++) {
            try {
                const connection = await this.createConnection();
                this.idleConnections.add(connection);
                this.pool.push(connection);
            } catch (error) {
                console.error('Failed to create initial Redis connection:', error);
            }
        }

        // Start cleanup and health check intervals
        this.startCleanupInterval();
        this.startHealthCheckInterval();
    }

    private async createConnection(): Promise<Redis> {
        const connection = new Redis({
            host: this.config.host,
            port: this.config.port,
            password: this.config.password,
            db: this.config.db,
            retryDelayOnFailover: this.config.retryDelayOnFailover,
            maxRetriesPerRequest: this.config.maxRetriesPerRequest,
            lazyConnect: this.config.lazyConnect,
            keepAlive: this.config.keepAlive,
            enableOfflineQueue: false,
            
            // Connection pool specific options
            maxRetriesPerRequest: 3,
            retryDelayOnFailover: 100,
            enableReadyCheck: true,
            showFriendlyErrorStack: true,
            
            // Performance optimizations
            enableAutoPipelining: true,
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            keepAlive: 30000,
            
            // Error handling
            enableOfflineQueue: false,
            connectTimeout: 10000,
            commandTimeout: 5000
        });

        // Handle connection events
        connection.on('error', (error) => {
            console.error('Redis connection error:', error);
            this.stats.totalFailed++;
            this.removeConnection(connection);
        });

        connection.on('close', () => {
            console.log('Redis connection closed');
            this.removeConnection(connection);
        });

        connection.on('reconnecting', () => {
            console.log('Redis connection reconnecting');
        });

        this.stats.totalCreated++;
        this.stats.totalConnections++;
        
        return connection;
    }

    public async acquire(): Promise<Redis> {
        return new Promise(async (resolve, reject) => {
            const timeoutId = setTimeout(() => {
                const index = this.pendingAcquires.findIndex(pending => pending.resolve === resolve);
                if (index !== -1) {
                    this.pendingAcquires.splice(index, 1);
                    this.stats.pendingAcquires--;
                }
                reject(new Error('Connection acquire timeout'));
            }, this.config.acquireTimeoutMs);

            try {
                // Try to get an idle connection first
                if (this.idleConnections.size > 0) {
                    const connection = this.idleConnections.values().next().value;
                    this.idleConnections.delete(connection);
                    this.activeConnections.add(connection);
                    
                    this.updateStats();
                    this.stats.totalAcquired++;
                    
                    clearTimeout(timeoutId);
                    resolve(connection);
                    return;
                }

                // If no idle connections and we can create more
                if (this.pool.length < this.config.maxConnections) {
                    try {
                        const connection = await this.createConnection();
                        this.pool.push(connection);
                        this.activeConnections.add(connection);
                        
                        this.updateStats();
                        this.stats.totalAcquired++;
                        
                        clearTimeout(timeoutId);
                        resolve(connection);
                        return;
                    } catch (error) {
                        clearTimeout(timeoutId);
                        reject(error);
                        return;
                    }
                }

                // Wait for a connection to become available
                this.pendingAcquires.push({
                    resolve: (connection: Redis) => {
                        clearTimeout(timeoutId);
                        resolve(connection);
                    },
                    reject: (error: Error) => {
                        clearTimeout(timeoutId);
                        reject(error);
                    },
                    timestamp: Date.now()
                });
                
                this.stats.pendingAcquires++;

            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }

    public release(connection: Redis): void {
        if (!this.activeConnections.has(connection)) {
            console.warn('Attempting to release connection that is not in active pool');
            return;
        }

        this.activeConnections.delete(connection);
        
        // Check if there are pending acquires
        if (this.pendingAcquires.length > 0) {
            const pending = this.pendingAcquires.shift();
            if (pending) {
                this.activeConnections.add(connection);
                this.stats.pendingAcquires--;
                this.stats.totalAcquired++;
                pending.resolve(connection);
            }
        } else {
            this.idleConnections.add(connection);
        }

        this.updateStats();
        this.stats.totalReleased++;
    }

    public async execute<T>(operation: (client: Redis) => Promise<T>): Promise<T> {
        const connection = await this.acquire();
        
        try {
            const result = await operation(connection);
            return result;
        } finally {
            this.release(connection);
        }
    }

    public async executeWithRetry<T>(
        operation: (client: Redis) => Promise<T>, 
        maxRetries: number = 3
    ): Promise<T> {
        let lastError: Error;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await this.execute(operation);
            } catch (error) {
                lastError = error as Error;
                
                if (attempt === maxRetries) {
                    break;
                }
                
                // Wait before retry with exponential backoff
                const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw lastError!;
    }

    public getStats(): PoolStats {
        this.updateStats();
        return { ...this.stats };
    }

    public async healthCheck(): Promise<boolean> {
        try {
            const connection = await this.acquire();
            try {
                await connection.ping();
                return true;
            } finally {
                this.release(connection);
            }
        } catch (error) {
            console.error('Redis pool health check failed:', error);
            return false;
        }
    }

    public async destroy(): Promise<void> {
        // Clear intervals
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }

        // Reject all pending acquires
        this.pendingAcquires.forEach(pending => {
            pending.reject(new Error('Pool is being destroyed'));
        });
        this.pendingAcquires = [];

        // Close all connections
        const closePromises = this.pool.map(connection => {
            return connection.disconnect();
        });

        await Promise.all(closePromises);
        
        this.pool = [];
        this.activeConnections.clear();
        this.idleConnections.clear();
        this.stats.totalDestroyed += this.stats.totalConnections;
        this.stats.totalConnections = 0;
    }

    private removeConnection(connection: Redis): void {
        const index = this.pool.indexOf(connection);
        if (index !== -1) {
            this.pool.splice(index, 1);
        }
        
        this.activeConnections.delete(connection);
        this.idleConnections.delete(connection);
        
        this.stats.totalConnections--;
        this.stats.totalDestroyed++;
        
        connection.disconnect();
    }

    private updateStats(): void {
        this.stats.activeConnections = this.activeConnections.size;
        this.stats.idleConnections = this.idleConnections.size;
        this.stats.totalConnections = this.pool.length;
    }

    private startCleanupInterval(): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, this.config.idleTimeoutMs);
    }

    private startHealthCheckInterval(): void {
        this.healthCheckInterval = setInterval(async () => {
            const isHealthy = await this.healthCheck();
            if (!isHealthy) {
                console.warn('Redis pool health check failed');
            }
        }, 60000); // Check every minute
    }

    private cleanup(): void {
        const now = Date.now();
        const connectionsToRemove: Redis[] = [];

        // Remove idle connections that have been idle too long
        this.idleConnections.forEach(connection => {
            // This is a simplified check - in a real implementation,
            // you'd track when each connection was last used
            if (this.idleConnections.size > this.config.minConnections) {
                connectionsToRemove.push(connection);
            }
        });

        connectionsToRemove.forEach(connection => {
            this.removeConnection(connection);
        });

        // Remove expired pending acquires
        this.pendingAcquires = this.pendingAcquires.filter(pending => {
            const isExpired = now - pending.timestamp > this.config.acquireTimeoutMs;
            if (isExpired) {
                pending.reject(new Error('Acquire request expired'));
                this.stats.pendingAcquires--;
            }
            return !isExpired;
        });
    }
}

// Export singleton instance
let poolInstance: RedisConnectionPool | null = null;

export const getRedisPool = (config?: Partial<RedisPoolConfig>): RedisConnectionPool => {
    if (!poolInstance) {
        poolInstance = new RedisConnectionPool(config);
    }
    return poolInstance;
};

export const destroyRedisPool = async (): Promise<void> => {
    if (poolInstance) {
        await poolInstance.destroy();
        poolInstance = null;
    }
};

export { RedisConnectionPool };