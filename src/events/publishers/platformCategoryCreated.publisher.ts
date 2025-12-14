import { Publisher, Subjects, PlatformCategoryCreatedEvent } from '../../common/events';
import { logger } from '../../services/logger.service';

/**
 * Platform Category Created Event Publisher
 * Publishes bulk category creation events from integration services
 */
export class PlatformCategoryCreatedPublisher extends Publisher<PlatformCategoryCreatedEvent> {
    subject: Subjects.PlatformCategoryCreated = Subjects.PlatformCategoryCreated;

    async publish(data: PlatformCategoryCreatedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger.info(`Platform categories created event published: ${data.integrationName}, ${data.categories.length} categories`);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error(`Failed to publish platform category created event after ${maxRetries} retries:`, error);
                    throw error;
                }
                logger.warn(`Retry attempt ${attempt} for platform category created event`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
