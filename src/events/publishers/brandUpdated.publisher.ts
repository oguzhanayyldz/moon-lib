import { Publisher, Subjects, BrandUpdatedEvent } from '../../common/events';
import { logger } from '../../services/logger.service';

/**
 * Brand Updated Event Publisher
 * Publishes brand update events from products service
 */
export class BrandUpdatedPublisher extends Publisher<BrandUpdatedEvent> {
    subject: Subjects.BrandUpdated = Subjects.BrandUpdated;

    async publish(data: BrandUpdatedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger.info(`Brand updated event published: ${data.brands.length} brands for user ${data.user}`);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error(`Failed to publish brand updated event after ${maxRetries} retries:`, error);
                    throw error;
                }
                logger.warn(`Retry attempt ${attempt} for brand updated event`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
