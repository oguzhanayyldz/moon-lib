import mongoose from 'mongoose';
import { logger } from '../services/logger.service';
import { natsWrapper } from '../services/natsWrapper.service';

/**
 * MongoDB Atlas Change Streams Manager
 * 
 * This service provides real-time monitoring capabilities using MongoDB Atlas Change Streams.
 * It enables instant data synchronization and reactive processing across microservices.
 * 
 * Key Features:
 * - Real-time inventory monitoring (low stock alerts, out of stock)
 * - Order status change tracking
 * - Price synchronization monitoring
 * - Automatic marketplace integration updates
 * - Event-driven reactive processing
 */

export interface ChangeStreamConfig {
    pipeline?: mongoose.PipelineStage[];
    options?: mongoose.ChangeStreamOptions;
    resumeToken?: mongoose.ResumeToken;
}

export interface InventoryAlert {
    type: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'STOCK_REPLENISHED';
    productId: string;
    currentStock?: number;
    threshold?: number;
    timestamp: number;
    warehouseId?: string;
}

export interface OrderStatusChange {
    orderId: string;
    oldStatus: string;
    newStatus: string;
    platform: string;
    timestamp: number;
}

export interface PriceChange {
    productId: string;
    oldPrice: number;
    newPrice: number;
    currency: string;
    timestamp: number;
    changeReason?: string;
}

export class ChangeStreamManager {
    private static instance: ChangeStreamManager;
    private watchers: Map<string, mongoose.ChangeStream> = new Map();
    private isInitialized: boolean = false;

    private constructor() {}

    public static getInstance(): ChangeStreamManager {
        if (!ChangeStreamManager.instance) {
            ChangeStreamManager.instance = new ChangeStreamManager();
        }
        return ChangeStreamManager.instance;
    }

    /**
     * Initialize all change streams
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            logger.warn('ChangeStreamManager already initialized');
            return;
        }

        logger.info('🔄 Initializing MongoDB Change Streams...');

        try {
            // Start all monitoring streams
            await Promise.all([
                this.startInventoryMonitoring(),
                this.startOrderStatusMonitoring(),
                this.startPriceMonitoring()
            ]);

            this.isInitialized = true;
            logger.info('✅ MongoDB Change Streams initialized successfully');
        } catch (error) {
            logger.error('❌ Failed to initialize Change Streams:', error);
            throw error;
        }
    }

    /**
     * Start monitoring inventory changes for low stock alerts and out of stock notifications
     */
    async startInventoryMonitoring(collectionName: string = 'productstocks'): Promise<string> {
        const watchId = 'inventory_monitoring';
        
        try {
            // Pipeline to monitor inventory changes
            const pipeline: mongoose.PipelineStage[] = [
                {
                    $match: {
                        'operationType': { $in: ['update', 'replace'] },
                        $or: [
                            { 'fullDocument.availableStock': { $lte: 10 } }, // Low stock threshold
                            { 'fullDocument.availableStock': { $eq: 0 } },   // Out of stock
                            { 
                                $and: [
                                    { 'updateDescription.updatedFields.availableStock': { $exists: true } },
                                    { 'fullDocument.availableStock': { $gt: 0 } },
                                    { 'updateDescription.updatedFields.availableStock': { $gt: 0 } }
                                ]
                            } // Stock replenished
                        ]
                    }
                }
            ];

            // Use direct collection access for flexibility
            const db = mongoose.connection.db;
            const changeStream = db.collection(collectionName).watch(pipeline, {
                fullDocument: 'updateLookup',
                resumeAfter: null
            });

            // Handle inventory changes
            changeStream.on('change', async (change: any) => {
                try {
                    await this.handleInventoryChange(change);
                } catch (error) {
                    logger.error(`Inventory change stream handler error:`, error);
                }
            });

            // Handle errors
            changeStream.on('error', (error) => {
                logger.error(`Inventory change stream error:`, error);
                // Attempt to restart the stream
                setTimeout(() => {
                    this.startInventoryMonitoring(collectionName);
                }, 5000);
            });

            this.watchers.set(watchId, changeStream);
            logger.info(`✅ Inventory monitoring started - Watch ID: ${watchId}, Collection: ${collectionName}`);
            
            return watchId;
        } catch (error) {
            logger.error(`Failed to start inventory monitoring:`, error);
            throw error;
        }
    }

    /**
     * Start monitoring order status changes
     */
    async startOrderStatusMonitoring(collectionName: string = 'orders'): Promise<string> {
        const watchId = 'order_status_monitoring';
        
        try {
            // Pipeline to monitor order status changes
            const pipeline: mongoose.PipelineStage[] = [
                {
                    $match: {
                        'operationType': 'update',
                        'updateDescription.updatedFields.status': { $exists: true }
                    }
                }
            ];

            // Use direct collection access for flexibility
            const db = mongoose.connection.db;
            const changeStream = db.collection(collectionName).watch(pipeline, {
                fullDocument: 'updateLookup'
            });

            // Handle order status changes
            changeStream.on('change', async (change: any) => {
                try {
                    await this.handleOrderStatusChange(change);
                } catch (error) {
                    logger.error(`Order status change stream handler error:`, error);
                }
            });

            // Handle errors
            changeStream.on('error', (error) => {
                logger.error(`Order status change stream error:`, error);
                // Attempt to restart the stream
                setTimeout(() => {
                    this.startOrderStatusMonitoring(collectionName);
                }, 5000);
            });

            this.watchers.set(watchId, changeStream);
            logger.info(`✅ Order status monitoring started - Watch ID: ${watchId}, Collection: ${collectionName}`);
            
            return watchId;
        } catch (error) {
            logger.error(`Failed to start order status monitoring:`, error);
            throw error;
        }
    }

    /**
     * Start monitoring price changes
     */
    async startPriceMonitoring(collectionName: string = 'prices'): Promise<string> {
        const watchId = 'price_monitoring';
        
        try {
            // Pipeline to monitor price changes
            const pipeline: mongoose.PipelineStage[] = [
                {
                    $match: {
                        'operationType': { $in: ['update', 'replace'] },
                        $or: [
                            { 'updateDescription.updatedFields.price': { $exists: true } },
                            { 'updateDescription.updatedFields.salePrice': { $exists: true } },
                            { 'updateDescription.updatedFields.listPrice': { $exists: true } }
                        ]
                    }
                }
            ];

            // Try to get Price collection
            try {
                const db = mongoose.connection.db;
                const changeStream = db.collection(collectionName).watch(pipeline, {
                    fullDocument: 'updateLookup'
                });

                // Handle price changes
                changeStream.on('change', async (change: any) => {
                    try {
                        await this.handlePriceChange(change);
                    } catch (error) {
                        logger.error(`Price change stream handler error:`, error);
                    }
                });

                // Handle errors
                changeStream.on('error', (error) => {
                    logger.error(`Price change stream error:`, error);
                    // Attempt to restart the stream
                    setTimeout(() => {
                        this.startPriceMonitoring(collectionName);
                    }, 5000);
                });

                this.watchers.set(watchId, changeStream);
                logger.info(`✅ Price monitoring started - Watch ID: ${watchId}, Collection: ${collectionName}`);
            } catch (collectionError) {
                logger.info(`📝 Price collection '${collectionName}' not available, skipping price monitoring`);
                return 'skipped';
            }
            
            return watchId;
        } catch (error) {
            logger.error(`Failed to start price monitoring:`, error);
            throw error;
        }
    }

    /**
     * Handle inventory change events
     */
    private async handleInventoryChange(change: any): Promise<void> {
        const { fullDocument, updateDescription } = change;
        
        if (!fullDocument) {
            return;
        }

        const productId = fullDocument.product || fullDocument.productId;
        const currentStock = fullDocument.availableStock || 0;
        const warehouseId = fullDocument.warehouse;

        logger.info(`📦 Inventory change detected - Product: ${productId}, Stock: ${currentStock}, Warehouse: ${warehouseId}`);

        // Determine alert type
        let alertType: InventoryAlert['type'];
        
        if (currentStock === 0) {
            alertType = 'OUT_OF_STOCK';
        } else if (currentStock <= 10) {
            alertType = 'LOW_STOCK';
        } else if (updateDescription?.updatedFields?.availableStock > 0) {
            // Check if stock was previously 0 and now > 0
            alertType = 'STOCK_REPLENISHED';
        } else {
            return; // No alert needed
        }

        // Create alert
        const alert: InventoryAlert = {
            type: alertType,
            productId,
            currentStock,
            threshold: alertType === 'LOW_STOCK' ? 10 : undefined,
            timestamp: Date.now(),
            warehouseId
        };

        // Publish alert to NATS
        try {
            await natsWrapper.client.publish('inventory.alerts', JSON.stringify(alert));
            logger.info(`📢 Inventory alert published - Type: ${alertType}, Product: ${productId}, Stock: ${currentStock}`);
        } catch (error) {
            logger.error(`Failed to publish inventory alert:`, error);
        }

        // Handle specific alert types
        switch (alertType) {
            case 'OUT_OF_STOCK':
                await this.handleOutOfStock(productId, warehouseId);
                break;
            case 'LOW_STOCK':
                await this.handleLowStock(productId, currentStock, warehouseId);
                break;
            case 'STOCK_REPLENISHED':
                await this.handleStockReplenished(productId, currentStock, warehouseId);
                break;
        }
    }

    /**
     * Handle order status change events
     */
    private async handleOrderStatusChange(change: any): Promise<void> {
        const { fullDocument, updateDescription } = change;
        
        if (!fullDocument || !updateDescription?.updatedFields?.status) {
            return;
        }

        const orderId = fullDocument._id.toString();
        const newStatus = updateDescription.updatedFields.status;
        const platform = fullDocument.platform;
        
        // We need to determine the old status (this is a limitation of change streams)
        // For now, we'll log the change and publish an event
        
        logger.info(`📋 Order status change detected - Order: ${orderId}, New Status: ${newStatus}, Platform: ${platform}`);

        const statusChange: OrderStatusChange = {
            orderId,
            oldStatus: 'unknown', // Change streams don't provide old values
            newStatus,
            platform,
            timestamp: Date.now()
        };

        // Publish status change to NATS
        try {
            await natsWrapper.client.publish('order.status.changed', JSON.stringify(statusChange));
            logger.info(`📢 Order status change published - Order: ${orderId}, Status: ${newStatus}`);
        } catch (error) {
            logger.error(`Failed to publish order status change:`, error);
        }

        // Handle specific status changes
        if (newStatus === 'shipped') {
            await this.handleOrderShipped(fullDocument);
        } else if (newStatus === 'delivered') {
            await this.handleOrderDelivered(fullDocument);
        } else if (newStatus === 'cancelled') {
            await this.handleOrderCancelled(fullDocument);
        }
    }

    /**
     * Handle price change events
     */
    private async handlePriceChange(change: any): Promise<void> {
        const { fullDocument, updateDescription } = change;
        
        if (!fullDocument || !updateDescription?.updatedFields) {
            return;
        }

        const productId = fullDocument.product || fullDocument.productId;
        const updatedFields = updateDescription.updatedFields;
        
        // Check which price field was updated
        let newPrice, oldPrice, priceField;
        
        if (updatedFields.price !== undefined) {
            newPrice = updatedFields.price;
            priceField = 'price';
        } else if (updatedFields.salePrice !== undefined) {
            newPrice = updatedFields.salePrice;
            priceField = 'salePrice';
        } else if (updatedFields.listPrice !== undefined) {
            newPrice = updatedFields.listPrice;
            priceField = 'listPrice';
        } else {
            return;
        }

        // For old price, we'd need to query or maintain history
        oldPrice = 0; // Placeholder - in real implementation, get from price history

        logger.info(`💰 Price change detected - Product: ${productId}, Field: ${priceField}, New Price: ${newPrice}`);

        const priceChange: PriceChange = {
            productId,
            oldPrice,
            newPrice,
            currency: fullDocument.currency || 'TRY',
            timestamp: Date.now(),
            changeReason: 'automatic_update'
        };

        // Publish price change to NATS
        try {
            await natsWrapper.client.publish('price.changed', JSON.stringify(priceChange));
            logger.info(`📢 Price change published - Product: ${productId}, New Price: ${newPrice}`);
        } catch (error) {
            logger.error(`Failed to publish price change:`, error);
        }
    }

    /**
     * Handle out of stock scenario
     */
    private async handleOutOfStock(productId: string, warehouseId?: string): Promise<void> {
        logger.warn(`🚨 OUT OF STOCK detected - Product: ${productId}, Warehouse: ${warehouseId}`);
        
        // Auto-disable product in marketplaces
        try {
            await natsWrapper.client.publish('marketplace.product.disable', JSON.stringify({
                productId,
                warehouseId,
                reason: 'out_of_stock',
                timestamp: Date.now()
            }));
            
            logger.info(`📢 Product disable request sent to marketplaces - Product: ${productId}`);
        } catch (error) {
            logger.error(`Failed to disable product in marketplaces:`, error);
        }
    }

    /**
     * Handle low stock scenario
     */
    private async handleLowStock(productId: string, currentStock: number, warehouseId?: string): Promise<void> {
        logger.warn(`⚠️ LOW STOCK detected - Product: ${productId}, Stock: ${currentStock}, Warehouse: ${warehouseId}`);
        
        // Trigger automatic reorder if configured
        try {
            await natsWrapper.client.publish('inventory.reorder.trigger', JSON.stringify({
                productId,
                currentStock,
                warehouseId,
                threshold: 10,
                timestamp: Date.now()
            }));
            
            logger.info(`📢 Reorder trigger sent - Product: ${productId}, Current Stock: ${currentStock}`);
        } catch (error) {
            logger.error(`Failed to trigger reorder:`, error);
        }
    }

    /**
     * Handle stock replenished scenario
     */
    private async handleStockReplenished(productId: string, currentStock: number, warehouseId?: string): Promise<void> {
        logger.info(`📈 STOCK REPLENISHED - Product: ${productId}, Stock: ${currentStock}, Warehouse: ${warehouseId}`);
        
        // Re-enable product in marketplaces if it was disabled
        try {
            await natsWrapper.client.publish('marketplace.product.enable', JSON.stringify({
                productId,
                warehouseId,
                currentStock,
                reason: 'stock_replenished',
                timestamp: Date.now()
            }));
            
            logger.info(`📢 Product enable request sent to marketplaces - Product: ${productId}`);
        } catch (error) {
            logger.error(`Failed to enable product in marketplaces:`, error);
        }
    }

    /**
     * Handle order shipped event
     */
    private async handleOrderShipped(orderDoc: any): Promise<void> {
        logger.info(`🚚 Order shipped - Order: ${orderDoc._id}, Platform: ${orderDoc.platform}`);
        
        // Trigger shipping notifications, tracking updates, etc.
        try {
            await natsWrapper.client.publish('order.shipped', JSON.stringify({
                orderId: orderDoc._id.toString(),
                platform: orderDoc.platform,
                trackingNumber: orderDoc.orderCargo?.trackingNumber,
                timestamp: Date.now()
            }));
        } catch (error) {
            logger.error(`Failed to publish order shipped event:`, error);
        }
    }

    /**
     * Handle order delivered event
     */
    private async handleOrderDelivered(orderDoc: any): Promise<void> {
        logger.info(`📦 Order delivered - Order: ${orderDoc._id}, Platform: ${orderDoc.platform}`);
        
        // Trigger delivery confirmations, review requests, etc.
        try {
            await natsWrapper.client.publish('order.delivered', JSON.stringify({
                orderId: orderDoc._id.toString(),
                platform: orderDoc.platform,
                timestamp: Date.now()
            }));
        } catch (error) {
            logger.error(`Failed to publish order delivered event:`, error);
        }
    }

    /**
     * Handle order cancelled event
     */
    private async handleOrderCancelled(orderDoc: any): Promise<void> {
        logger.info(`❌ Order cancelled - Order: ${orderDoc._id}, Platform: ${orderDoc.platform}`);
        
        // Trigger inventory restoration, refund processing, etc.
        try {
            await natsWrapper.client.publish('order.cancelled', JSON.stringify({
                orderId: orderDoc._id.toString(),
                platform: orderDoc.platform,
                timestamp: Date.now()
            }));
        } catch (error) {
            logger.error(`Failed to publish order cancelled event:`, error);
        }
    }

    /**
     * Stop a specific change stream watcher
     */
    async stopWatcher(watchId: string): Promise<void> {
        const watcher = this.watchers.get(watchId);
        if (watcher) {
            await watcher.close();
            this.watchers.delete(watchId);
            logger.info(`🛑 Change stream watcher stopped - ID: ${watchId}`);
        }
    }

    /**
     * Stop all change stream watchers
     */
    async stopAll(): Promise<void> {
        logger.info('🛑 Stopping all change stream watchers...');
        
        for (const [watchId, watcher] of this.watchers) {
            try {
                await watcher.close();
                logger.info(`✅ Stopped watcher: ${watchId}`);
            } catch (error) {
                logger.error(`Failed to stop watcher ${watchId}:`, error);
            }
        }
        
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
            features: {
                inventoryMonitoring: this.watchers.has('inventory_monitoring'),
                orderStatusMonitoring: this.watchers.has('order_status_monitoring'),
                priceMonitoring: this.watchers.has('price_monitoring')
            }
        };
    }
}

// Export singleton instance
export const changeStreamManager = ChangeStreamManager.getInstance();