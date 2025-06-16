import { Publisher, Subjects, StockUpdatedEvent } from '../../common';
import { logger } from '../../services/logger.service';

export class StockUpdatedPublisher extends Publisher<StockUpdatedEvent> {
    subject: Subjects.StockUpdated = Subjects.StockUpdated;

    async publish(data: StockUpdatedEvent['data']): Promise<void> {
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