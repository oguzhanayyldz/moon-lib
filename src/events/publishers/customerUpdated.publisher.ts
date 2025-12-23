import { Publisher, Subjects, CustomerUpdatedEvent } from '../../common';
import { logger } from '../../services/logger.service';

export class CustomerUpdatedPublisher extends Publisher<CustomerUpdatedEvent> {
    subject: Subjects.CustomerUpdated = Subjects.CustomerUpdated;

    async publish(data: CustomerUpdatedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000; // 1 saniye

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('Failed to publish CustomerUpdated event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
