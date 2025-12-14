import { Publisher, Subjects, CategoryUpdatedEvent } from '../../common/events';
import { logger } from '../../services/logger.service';

/**
 * Category Updated Event Publisher
 * Publishes category update events from products service
 */
export class CategoryUpdatedPublisher extends Publisher<CategoryUpdatedEvent> {
    subject: Subjects.CategoryUpdated = Subjects.CategoryUpdated;

    async publish(data: CategoryUpdatedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger.info(`Category updated event published: ${data.categories.length} categories for user ${data.user}`);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error(`Failed to publish category updated event after ${maxRetries} retries:`, error);
                    throw error;
                }
                logger.warn(`Retry attempt ${attempt} for category updated event`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
