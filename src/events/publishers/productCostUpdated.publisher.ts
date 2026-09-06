import { Publisher, Subjects, ProductCostUpdatedEvent } from '../../common';
import { logger } from '../../services/logger.service';

/**
 * Urun maliyeti guncelleme publisher'i (issue #638)
 * ProductPriceUpdatedPublisher ile ayni retry davranisi.
 */
export class ProductCostUpdatedPublisher extends Publisher<ProductCostUpdatedEvent> {
    subject: Subjects.ProductCostUpdated = Subjects.ProductCostUpdated;

    async publish(data: ProductCostUpdatedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000; // 1 saniye

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('Failed to publish ProductCostUpdated event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
