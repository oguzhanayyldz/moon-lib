import { Publisher, Subjects, ProductStockBulkUpdatedEvent } from '../../common';
import { logger } from '../../services/logger.service';

export class ProductStockBulkUpdatedPublisher extends Publisher<ProductStockBulkUpdatedEvent> {
    subject: Subjects.ProductStockBulkUpdated = Subjects.ProductStockBulkUpdated;

    async publish(data: ProductStockBulkUpdatedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger.info(
                    `✅ ProductStockBulkUpdated published: ${data.items.length} items, source=${data.source ?? 'n/a'} (requestId=${data.requestId})`
                );
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('❌ Failed to publish ProductStockBulkUpdated event:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
