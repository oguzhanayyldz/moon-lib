import { Publisher, Subjects, PlatformBrandSyncedEvent } from '../../common/events';
import { logger } from '../../services/logger.service';

/**
 * Platform Brand Synced Event Publisher
 * Publishes bulk brand sync events from integration services
 */
export class PlatformBrandSyncedPublisher extends Publisher<PlatformBrandSyncedEvent> {
    subject: Subjects.PlatformBrandSynced = Subjects.PlatformBrandSynced;

    async publish(data: PlatformBrandSyncedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger.info(`Platform brands synced event published: ${data.integrationName}, ${data.brands.length} brands`);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error(`Failed to publish platform brand synced event after ${maxRetries} retries:`, error);
                    throw error;
                }
                logger.warn(`Retry attempt ${attempt} for platform brand synced event`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
