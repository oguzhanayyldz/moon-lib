import { Publisher, Subjects, PlatformCategorySyncedEvent } from '../../common/events';
import { logger } from '../../services/logger.service';

/**
 * Platform Category Synced Event Publisher
 * Publishes bulk category sync events from integration services
 */
export class PlatformCategorySyncedPublisher extends Publisher<PlatformCategorySyncedEvent> {
    subject: Subjects.PlatformCategorySynced = Subjects.PlatformCategorySynced;

    async publish(data: PlatformCategorySyncedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger.info(`Platform categories synced event published: ${data.integrationName}, ${data.categories.length} categories`);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error(`Failed to publish platform category synced event after ${maxRetries} retries:`, error);
                    throw error;
                }
                logger.warn(`Retry attempt ${attempt} for platform category synced event`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
