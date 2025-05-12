import { Publisher, Subjects, CombinationUpdatedEvent } from '@xmoonx/common';
import { logger } from '../../services/logger.service';

export class CombinationUpdatedPublisher extends Publisher<CombinationUpdatedEvent> {
    subject: Subjects.CombinationUpdated = Subjects.CombinationUpdated;

    async publish(data: CombinationUpdatedEvent['data']): Promise<void> {
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