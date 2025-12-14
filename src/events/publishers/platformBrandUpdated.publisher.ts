import { Publisher, Subjects, PlatformBrandUpdatedEvent } from '../../common/events';
import { logger } from '../../services/logger.service';

/**
 * Platform Brand Updated Event Publisher
 * Publishes bulk brand update events from integration services
 */
export class PlatformBrandUpdatedPublisher extends Publisher<PlatformBrandUpdatedEvent> {
    subject: Subjects.PlatformBrandUpdated = Subjects.PlatformBrandUpdated;

    async publish(data: PlatformBrandUpdatedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger.info(`Platform brands updated event published: ${data.integrationName}, ${data.brands.length} brands`);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error(`Failed to publish platform brand updated event after ${maxRetries} retries:`, error);
                    throw error;
                }
                logger.warn(`Retry attempt ${attempt} for platform brand updated event`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
