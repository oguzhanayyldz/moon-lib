import mongoose from 'mongoose';
import { createOutboxModel } from './models/outbox.schema';
import { createDeadLetterModel } from './models/deadLetter.schema';

// Models
export * from './models/base/base.schema';
export * from './models/outbox.schema';
export * from './models/deadLetter.schema';

// Services
export * from './services/natsWrapper.service';
export * from './services/tracer.service';
export * from './services/redisWrapper.service';
export * from './services/retryManager';

// Jobs
export * from './jobs/eventPublisher.job';
export * from './jobs/deadLetterProcessor.job';

// Events
export * from './events/publishers/userCreated.publisher';
export * from './events/publishers/userUpdated.publisher';
export * from './events/publishers/productCreated.publisher';
export * from './events/publishers/productUpdated.publisher';
export * from './events/publishers/productIntegrationCreated.publisher';
export * from './events/publishers/combinationCreated.publisher';
export * from './events/publishers/combinationUpdated.publisher';
export * from './events/publishers/packageProductLinkCreated.publisher';
export * from './events/publishers/packageProductLinkUpdated.publisher';
export * from './events/publishers/relationProductLinkCreated.publisher';
export * from './events/publishers/relationProductLinkUpdated.publisher';
export * from './events/publishers/integrationCommand.publisher';
export * from './events/publishers/integrationCommandResult.publisher';
export * from './events/publishers/productStockCreated.publisher';
export * from './events/publishers/productStockUpdated.publisher';
export * from './events/publishers/stockCreated.publisher';
export * from './events/publishers/stockUpdated.publisher';
export * from './events/publishers/orderCreated.publisher';
export * from './events/publishers/orderUpdated.publisher';
export * from './events/publishers/orderStatusUpdated.publisher';
export * from './events/retryableListener';
export * from './events/publishers/deleteProductImagesCompletedPublisher.publisher';
export * from './events/publishers/deleteProductImagesPublisher.publisher';
export * from './events/publishers/importImagesFromUrlsCompletedPublisher.publisher';
export * from './events/publishers/importImagesFromUrlsPublisher.publisher';
export * from './events/publishers/productPriceIntegrationUpdated.publisher';
export * from './events/publishers/productPriceUpdated.publisher';
export * from './events/publishers/productStockIntegrationUpdated.publisher';

// Model başlatma fonksiyonu
export const initializeModels = (connection: mongoose.Connection): void => {
    createOutboxModel(connection);
    createDeadLetterModel(connection);
};