import { Publisher, Subjects, ProductIntegrationCreatedEvent, OrderIntegrationStatusUpdatedEvent } from '../../common';
import { logger } from '../../services/logger.service';

export class OrderIntegrationStatusUpdatedPublisher extends Publisher<OrderIntegrationStatusUpdatedEvent> {
    subject: Subjects.OrderIntegrationStatusUpdated = Subjects.OrderIntegrationStatusUpdated;

    async publish(data: OrderIntegrationStatusUpdatedEvent['data']): Promise<void> {
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