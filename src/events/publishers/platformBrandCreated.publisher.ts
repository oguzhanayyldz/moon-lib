import { Publisher, Subjects, PlatformBrandCreatedEvent } from '../../common/events';
import { logger } from '../../services/logger.service';

/**
 * Platform Brand Created Event Publisher
 * Publishes bulk brand creation events from integration services
 */
export class PlatformBrandCreatedPublisher extends Publisher<PlatformBrandCreatedEvent> {
    subject: Subjects.PlatformBrandCreated = Subjects.PlatformBrandCreated;

    async publish(data: PlatformBrandCreatedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger.info(`Platform brands created event published: ${data.integrationName}, ${data.brands.length} brands`);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error(`Failed to publish platform brand created event after ${maxRetries} retries:`, error);
                    throw error;
                }
                logger.warn(`Retry attempt ${attempt} for platform brand created event`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
