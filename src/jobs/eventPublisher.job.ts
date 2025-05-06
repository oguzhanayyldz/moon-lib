import mongoose from 'mongoose';
import { Stan } from 'node-nats-streaming';
import { Subjects } from '@xmoonx/common';
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
            const pendingEvents = await this.outboxModel.find({
                status: 'pending',
                retryCount: { $lt: 5 }
            })
                .sort({ createdAt: 1 })
                .limit(10); // Batch processing

            for (const event of pendingEvents) {
                try {
                    await this.publishEvent(event);
                    event.status = 'published';
                    await event.save();
                    console.log(`Successfully published event ${event.id}`);
                } catch (error) {
                    event.status = 'failed';
                    event.retryCount += 1;
                    event.lastAttempt = new Date();
                    await event.save();
                    console.error(`Failed to publish event ${event.id}:`, error);
                }
            }
        } catch (error) {
            console.error('Event processing failed:', error);
        }
    }


    private async monitorFailedEvents() {
        try {
            const failedEvents = await this.outboxModel.countDocuments({
                status: 'failed',
                retryCount: { $gte: 5 }
            });

            if (failedEvents >= EventPublisherJob.ALERT_THRESHOLD) {
                console.error(`ALERT: ${failedEvents} events have failed permanently!`);
                // Burada alert sisteminize bağlanabilirsiniz (Slack, Email, vs.)
            }
        } catch (error) {
            console.error('Monitoring failed:', error);
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
            default:
                throw new Error(`Unknown event type: ${event.eventType}`);
        }
    }
}