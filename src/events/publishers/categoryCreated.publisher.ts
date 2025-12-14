import { Publisher, Subjects, CategoryCreatedEvent } from '../../common/events';
import { logger } from '../../services/logger.service';

/**
 * Category Created Event Publisher
 * Publishes category creation events from products service
 */
export class CategoryCreatedPublisher extends Publisher<CategoryCreatedEvent> {
    subject: Subjects.CategoryCreated = Subjects.CategoryCreated;

    async publish(data: CategoryCreatedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger.info(`Category created event published: ${data.categories.length} categories for user ${data.user}`);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error(`Failed to publish category created event after ${maxRetries} retries:`, error);
                    throw error;
                }
                logger.warn(`Retry attempt ${attempt} for category created event`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
