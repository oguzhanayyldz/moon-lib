import { Publisher, Subjects, PriceProcessingCompletedEvent } from '../../common';
import { logger } from '../../services/logger.service';

export class PriceProcessingCompletedPublisher extends Publisher<PriceProcessingCompletedEvent> {
    subject: Subjects.PriceProcessingCompleted = Subjects.PriceProcessingCompleted;

    async publish(data: PriceProcessingCompletedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('Failed to publish PriceProcessingCompleted event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
