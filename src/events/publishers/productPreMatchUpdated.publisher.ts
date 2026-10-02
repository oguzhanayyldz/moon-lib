import { ProductPreMatchUpdatedEvent, Publisher, Subjects } from '../../common';
import { logger } from '../../services/logger.service';

/**
 * ProductPreMatchUpdated Publisher (TASK-MURHHI9UCDMZW)
 *
 * Entegrasyon servisleri "Eşleşen" ürünlerin eşleşme verisini ve karar durumunu catalog'a
 * geri beslerken bu publisher'ı kullanır. IntegrationCommandResultPublisher ile
 * aynı retry stratejisini izler.
 */
export class ProductPreMatchUpdatedPublisher extends Publisher<ProductPreMatchUpdatedEvent> {
    subject: Subjects.ProductPreMatchUpdated = Subjects.ProductPreMatchUpdated;

    async publish(data: ProductPreMatchUpdatedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000; // 1 saniye

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('Failed to publish ProductPreMatchUpdated event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
