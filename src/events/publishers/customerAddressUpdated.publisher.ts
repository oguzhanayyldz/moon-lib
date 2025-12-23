import { Publisher, Subjects, CustomerAddressUpdatedEvent } from '../../common';
import { logger } from '../../services/logger.service';

export class CustomerAddressUpdatedPublisher extends Publisher<CustomerAddressUpdatedEvent> {
    subject: Subjects.CustomerAddressUpdated = Subjects.CustomerAddressUpdated;

    async publish(data: CustomerAddressUpdatedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000; // 1 saniye

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('Failed to publish CustomerAddressUpdated event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
