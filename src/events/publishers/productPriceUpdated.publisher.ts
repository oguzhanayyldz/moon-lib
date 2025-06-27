import { Publisher, Subjects, ProductPriceUpdatedEvent } from '../../common';
import { logger } from '../../services/logger.service';

export class ProductPriceUpdatedPublisher extends Publisher<ProductPriceUpdatedEvent> {
    subject: Subjects.ProductPriceUpdated = Subjects.ProductPriceUpdated

    async publish(data: ProductPriceUpdatedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000; // 1 saniye
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    // Son denemede de başarısız olursa loglama yap
                    logger.error('Failed to publish event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}