import { Publisher, Subjects, PlatformCategoryUpdatedEvent } from '../../common/events';
import { logger } from '../../services/logger.service';

/**
 * Platform Category Updated Event Publisher
 * Publishes bulk category update events from integration services
 */
export class PlatformCategoryUpdatedPublisher extends Publisher<PlatformCategoryUpdatedEvent> {
    subject: Subjects.PlatformCategoryUpdated = Subjects.PlatformCategoryUpdated;

    async publish(data: PlatformCategoryUpdatedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger.info(`Platform categories updated event published: ${data.integrationName}, ${data.categories.length} categories`);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error(`Failed to publish platform category updated event after ${maxRetries} retries:`, error);
                    throw error;
                }
                logger.warn(`Retry attempt ${attempt} for platform category updated event`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
