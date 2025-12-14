import { Publisher, Subjects, BrandCreatedEvent } from '../../common/events';
import { logger } from '../../services/logger.service';

/**
 * Brand Created Event Publisher
 * Publishes brand creation events from products service
 */
export class BrandCreatedPublisher extends Publisher<BrandCreatedEvent> {
    subject: Subjects.BrandCreated = Subjects.BrandCreated;

    async publish(data: BrandCreatedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger.info(`Brand created event published: ${data.brands.length} brands for user ${data.user}`);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error(`Failed to publish brand created event after ${maxRetries} retries:`, error);
                    throw error;
                }
                logger.warn(`Retry attempt ${attempt} for brand created event`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
