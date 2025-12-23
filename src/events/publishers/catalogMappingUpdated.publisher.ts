import { Publisher, Subjects, CatalogMappingUpdatedEvent } from '../../common';
import { logger } from '../../services/logger.service';

export class CatalogMappingUpdatedPublisher extends Publisher<CatalogMappingUpdatedEvent> {
    subject: Subjects.CatalogMappingUpdated = Subjects.CatalogMappingUpdated;

    async publish(data: CatalogMappingUpdatedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000; // 1 saniye

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('Failed to publish CatalogMappingUpdated event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
