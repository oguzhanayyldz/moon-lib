import mongoose from 'mongoose';
import { Stan } from 'node-nats-streaming';
import { Subjects } from '../common/';
import { createOutboxModel, OutboxModel } from '../models/outbox.schema';
import { ProductCreatedPublisher } from '../events/publishers/productCreated.publisher';
import { ProductUpdatedPublisher } from '../events/publishers/productUpdated.publisher';
import { PackageProductLinkCreatedPublisher } from '../events/publishers/packageProductLinkCreated.publisher';
import { PackageProductLinkUpdatedPublisher } from '../events/publishers/packageProductLinkUpdated.publisher';
import { RelationProductLinkCreatedPublisher } from '../events/publishers/relationProductLinkCreated.publisher';
import { RelationProductLinkUpdatedPublisher } from '../events/publishers/relationProductLinkUpdated.publisher';
import { CombinationCreatedPublisher } from '../events/publishers/combinationCreated.publisher';
import { CombinationUpdatedPublisher } from '../events/publishers/combinationUpdated.publisher';
import { UserCreatedPublisher } from '../events/publishers/userCreated.publisher';
import { UserUpdatedPublisher } from '../events/publishers/userUpdated.publisher';
import { IntegrationCommandPublisher } from '../events/publishers/integrationCommand.publisher';
import { ProductStockCreatedPublisher } from '../events/publishers/productStockCreated.publisher';
import { ProductStockUpdatedPublisher } from '../events/publishers/productStockUpdated.publisher';
import { StockCreatedPublisher } from '../events/publishers/stockCreated.publisher';
import { StockUpdatedPublisher } from '../events/publishers/stockUpdated.publisher';
import { OrderCreatedPublisher } from '../events/publishers/orderCreated.publisher';
import { OrderUpdatedPublisher } from '../events/publishers/orderUpdated.publisher';
import { EntityDeletedPublisher } from '../events/publishers/entityDeleted.publisher';
import { OrderStatusUpdatedPublisher } from '../events/publishers/orderStatusUpdated.publisher';
import { IntegrationCommandResultPublisher } from '../events/publishers/integrationCommandResult.publisher';
import { ProductIntegrationCreatedPublisher } from '../events/publishers/productIntegrationCreated.publisher';
import { DeleteProductImagesCompletedPublisher } from '../events/publishers/deleteProductImagesCompletedPublisher.publisher';
import { DeleteProductImagesPublisher } from '../events/publishers/deleteProductImagesPublisher.publisher';
import { ImportImagesFromUrlsPublisher } from '../events/publishers/importImagesFromUrlsPublisher.publisher';
import { ImportImagesFromUrlsCompletedPublisher } from '../events/publishers/importImagesFromUrlsCompletedPublisher.publisher';
import { ProductPriceIntegrationUpdatedPublisher } from '../events/publishers/productPriceIntegrationUpdated.publisher';
import { ProductPriceUpdatedPublisher } from '../events/publishers/productPriceUpdated.publisher';
import { ProductErpIdUpdatedPublisher } from '../events/publishers/productErpIdUpdated.publisher';
import { ProductStockIntegrationUpdatedPublisher } from '../events/publishers/productStockIntegrationUpdated.publisher';
import { ProductImageIntegrationUpdatedPublisher } from '../events/publishers/productImageIntegrationUpdated.publisher';
import { CatalogMappingCreatedPublisher } from '../events/publishers/catalogMappingCreated.publisher';
import { ProductIntegrationSyncedPublisher } from '../events/publishers/productIntegrationSynced.publisher';
import { OrderIntegrationCreatedPublisher } from '../events/publishers/orderIntegrationCreated.publisher';
import { logger } from '../services/logger.service';
import { IntegrationCreatedPublisher } from '../events/publishers/integrationCreated.publisher';
import { UserIntegrationSettingsPublisher } from '../events/publishers/userIntegrationSettings.publisher';
import { OrderIntegrationStatusUpdatedPublisher } from '../events/publishers/orderIntegrationStatusUpdated.publisher';
import { ProductMatchedPublisher } from '../events/publishers/productMatched.publisher';
import { NotificationCreatedPublisher } from '../events/publishers/notificationCreated.publisher';
import { OrderProductStockUpdatedPublisher } from '../events/publishers/orderProductUpdated.publisher';
import { EntityVersionUpdatedPublisher } from '../events/publishers/entityVersionUpdated.publisher';
import { SyncRequestedPublisher } from '../events/publishers/syncRequested.publisher';
import { InvoiceCreatedPublisher } from '../events/publishers/invoiceCreated.publisher';
import { InvoiceUpdatedPublisher } from '../events/publishers/invoiceUpdated.publisher';
import { InvoiceFormalizedPublisher } from '../events/publishers/invoiceFormalized.publisher';
import { InvoiceFailedPublisher } from '../events/publishers/invoiceFailed.publisher';
import { OrderCargoUpdatedPublisher } from '../events/publishers/orderCargoUpdated.publisher';
import { ShipmentCreatedPublisher } from '../events/publishers/shipmentCreated.publisher';
import { ShipmentUpdatedPublisher } from '../events/publishers/shipmentUpdated.publisher';
import { ExcelFileGeneratedPublisher } from '../events/publishers/excelFileGenerated.publisher';
import { ExcelFileStoredPublisher } from '../events/publishers/excelFileStored.publisher';
import { PlatformCategoryCreatedPublisher } from '../events/publishers/platformCategoryCreated.publisher';
import { PlatformCategoryUpdatedPublisher } from '../events/publishers/platformCategoryUpdated.publisher';
import { PlatformBrandCreatedPublisher } from '../events/publishers/platformBrandCreated.publisher';
import { PlatformBrandUpdatedPublisher } from '../events/publishers/platformBrandUpdated.publisher';
import { CategoryCreatedPublisher } from '../events/publishers/categoryCreated.publisher';
import { CategoryUpdatedPublisher } from '../events/publishers/categoryUpdated.publisher';
import { BrandCreatedPublisher } from '../events/publishers/brandCreated.publisher';
import { BrandUpdatedPublisher } from '../events/publishers/brandUpdated.publisher';


export class EventPublisherJob {
    private static readonly RETRY_INTERVAL = 5000; // 5 saniye
    private static readonly ALERT_THRESHOLD = 5; // 5 başarısız event alert eşiği
    private intervalId: NodeJS.Timeout | null = null;
    private monitoringId: NodeJS.Timeout | null = null;
    private readonly outboxModel: OutboxModel;

    constructor (
        private natsClient: Stan,
        private connection: mongoose.Connection
    ) {
        this.outboxModel = createOutboxModel(connection);
    }

    async start() {
        // Event publishing job
        this.intervalId = setInterval(async () => {
            await this.processEvents();
        }, EventPublisherJob.RETRY_INTERVAL);

        // Monitoring job
        this.monitoringId = setInterval(async () => {
            await this.monitorFailedEvents();
        }, EventPublisherJob.RETRY_INTERVAL);
    }

    stop() {
        [this.intervalId, this.monitoringId].forEach(interval => {
            if (interval) clearInterval(interval);
        });
        this.intervalId = null;
        this.monitoringId = null;
    }

    private async processEvents() {
        try {
            // Sadece bu environment'a ait pending eventleri al
            const currentEnvironment = process.env.NODE_ENV || 'production';

            const pendingEvents = await this.outboxModel.find({
                status: 'pending',
                environment: currentEnvironment,
                retryCount: { $lt: 5 }
            })
                .sort({ createdAt: 1 })
                .limit(10);

            if (pendingEvents.length > 0) {
                logger.debug(`Processing ${pendingEvents.length} events for environment: ${currentEnvironment}`);
            }
                
            for (const event of pendingEvents) {
                try {
                    // Atomik güncelleme: pending durumundaki event'i processing olarak işaretle
                    // ve aynı zamanda versiyon kontrolü yap
                    const updated = await this.outboxModel.updateOne(
                        { 
                            _id: event.id, 
                            status: 'pending',
                            retryCount: event.retryCount // Versiyon kontrolü sağlar
                        },
                        { 
                            $set: { 
                                status: 'processing',
                                processingStartedAt: new Date()
                            }
                        }
                    );
                    
                    // Event başka bir pod tarafından alınmış demektir, atla
                    if (updated.modifiedCount === 0) {
                        logger.info(`Event ${event.id} is already being processed by another publisher, skipping`);
                        continue;
                    }
                    
                    await this.publishEvent(event);
                    
                    // Başarılı olarak işaretle
                    await this.outboxModel.updateOne(
                        { _id: event.id, status: 'processing' },
                        { $set: { status: 'published' } }
                    );
                    
                    logger.info(`Successfully published event ${event.id}`);
                } catch (error) {
                    await this.outboxModel.updateOne(
                        { _id: event.id, status: 'processing' },
                        { 
                            $set: { status: 'failed', lastAttempt: new Date() },
                            $inc: { retryCount: 1 } 
                        }
                    );
                    logger.error(`Failed to publish event ${event.id}:`, error);
                }
            }
        } catch (error) {
            logger.error('Event processing failed:', error);
        }
    }

    private async monitorFailedEvents() {
        try {
            // Çok uzun süre processing durumunda kalan kayıtları kontrol et
            const stuckEvents = await this.outboxModel.find({
                status: 'processing',
                processingStartedAt: { 
                    $lt: new Date(Date.now() - 5 * 60 * 1000) // 5 dakikadan eski 
                }
            });
            
            if (stuckEvents.length > 0) {
                logger.warn(`Found ${stuckEvents.length} stuck events in processing state`);
                
                for (const event of stuckEvents) {
                    await this.outboxModel.updateOne(
                        { _id: event.id, status: 'processing' },
                        { 
                            $set: { status: 'pending' }, 
                            $unset: { processingStartedAt: 1 }
                        }
                    );
                }
            }
            
            // Diğer mevcut monitoring kodları...
            const failedEvents = await this.outboxModel.countDocuments({
                status: 'failed',
                retryCount: { $gte: 5 }
            });

            if (failedEvents >= EventPublisherJob.ALERT_THRESHOLD) {
                logger.error(`ALERT: ${failedEvents} events have failed permanently!`);
                // Burada alert sisteminize bağlanabilirsiniz (Slack, Email, vs.)
            }
        } catch (error) {
            logger.error('Monitoring failed:', error);
        }
    }

    private async publishEvent(event: any) {
        switch (event.eventType) {
            case Subjects.ProductCreated:
                await new ProductCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.ProductUpdated:
                await new ProductUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.CombinationCreated:
                await new CombinationCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.CombinationUpdated:
                await new CombinationUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.PackageProductLinkCreated:
                await new PackageProductLinkCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.PackageProductLinkUpdated:
                await new PackageProductLinkUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.RelationProductLinkCreated:
                await new RelationProductLinkCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.RelationProductLinkUpdated:
                await new RelationProductLinkUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.UserCreated:
                await new UserCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.UserUpdated:
                await new UserUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.IntegrationCommand:
                await new IntegrationCommandPublisher(this.natsClient)
                    .publish({ requestId: event.id, ...event.payload });
                break;
            case Subjects.IntegrationCommandResult:
                await new IntegrationCommandResultPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.ProductStockCreated:
                await new ProductStockCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.ProductStockUpdated:
                await new ProductStockUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.StockCreated:
                await new StockCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.StockUpdated:
                await new StockUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.OrderCreated:
                await new OrderCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.OrderUpdated:
                await new OrderUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.OrderStatusUpdated:
                await new OrderStatusUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.EntityDeleted:
                await new EntityDeletedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.ProductIntegrationCreated:
                await new ProductIntegrationCreatedPublisher(this.natsClient)
                    .publish({ requestId: event.id, ...event.payload });
                break;
            case Subjects.ImportImagesFromUrls:
                await new ImportImagesFromUrlsPublisher(this.natsClient)
                    .publish(event.payload);
                    break;
            case Subjects.ImportImagesFromUrlsCompleted:
                await new ImportImagesFromUrlsCompletedPublisher(this.natsClient)
                    .publish(event.payload);
                    break;
            case Subjects.DeleteProductImages:
                await new DeleteProductImagesPublisher(this.natsClient)
                    .publish(event.payload);
                    break;
            case Subjects.DeleteProductImagesCompleted:
                await new DeleteProductImagesCompletedPublisher(this.natsClient)
                    .publish(event.payload);
                    break;
            case Subjects.ProductPriceIntegrationUpdated:
                await new ProductPriceIntegrationUpdatedPublisher(this.natsClient)
                    .publish({ requestId: event.id, ...event.payload });
                    break;
            case Subjects.ProductPriceUpdated:
                await new ProductPriceUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                    break;
            case Subjects.ProductErpIdUpdated:
                await new ProductErpIdUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                    break;
            case Subjects.ProductStockIntegrationUpdated:
                await new ProductStockIntegrationUpdatedPublisher(this.natsClient)
                    .publish({ requestId: event.id, ...event.payload });
                    break;
            case Subjects.ProductImageIntegrationUpdated:
                await new ProductImageIntegrationUpdatedPublisher(this.natsClient)
                    .publish({ requestId: event.id, ...event.payload });
                    break;
            case Subjects.CatalogMappingCreated:
                await new CatalogMappingCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                    break;
            case Subjects.ProductIntegrationSynced:
                await new ProductIntegrationSyncedPublisher(this.natsClient)
                    .publish(event.payload);
                    break;
            case Subjects.OrderIntegrationCreated:
                await new OrderIntegrationCreatedPublisher(this.natsClient)
                    .publish({ requestId: event.id, ...event.payload });
                    break;
            case Subjects.IntegrationCreated:
                await new IntegrationCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.UserIntegrationSettings:
                await new UserIntegrationSettingsPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.OrderIntegrationStatusUpdated:
                await new OrderIntegrationStatusUpdatedPublisher(this.natsClient)
                    .publish({ requestId: event.id, ...event.payload });
                break;
            case Subjects.ProductMatched:
                await new ProductMatchedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.NotificationCreated:
                await new NotificationCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.OrderProductUpdated:
                await new OrderProductStockUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.EntityVersionUpdated:
                await new EntityVersionUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.SyncRequested:
                await new SyncRequestedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.InvoiceCreated:
                await new InvoiceCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.InvoiceUpdated:
                await new InvoiceUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.InvoiceFormalized:
                await new InvoiceFormalizedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.InvoiceFailed:
                await new InvoiceFailedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.OrderCargoUpdated:
                await new OrderCargoUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.ShipmentCreated:
                await new ShipmentCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.ShipmentUpdated:
                await new ShipmentUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.ExcelFileGenerated:
                await new ExcelFileGeneratedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.ExcelFileStored:
                await new ExcelFileStoredPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.PlatformCategoryCreated:
                await new PlatformCategoryCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.PlatformCategoryUpdated:
                await new PlatformCategoryUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.PlatformBrandCreated:
                await new PlatformBrandCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.PlatformBrandUpdated:
                await new PlatformBrandUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.CategoryCreated:
                await new CategoryCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.CategoryUpdated:
                await new CategoryUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.BrandCreated:
                await new BrandCreatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            case Subjects.BrandUpdated:
                await new BrandUpdatedPublisher(this.natsClient)
                    .publish(event.payload);
                break;
            default:
                throw new Error(`Unknown event type: ${event.eventType}`);
        }
    }
}