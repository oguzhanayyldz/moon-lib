import { Publisher, Subjects, EntityVersionBulkUpdatedEvent } from '../../common';
import { logger } from '../../services/logger.service';

/**
 * Entity Version Bulk Updated Publisher
 * EventPublisherJob tarafından biriktirilen EntityVersionUpdated eventlerini
 * tek bir bulk mesaj olarak publish eder
 */
export class EntityVersionBulkUpdatedPublisher extends Publisher<EntityVersionBulkUpdatedEvent> {
    subject: Subjects.EntityVersionBulkUpdated = Subjects.EntityVersionBulkUpdated;

    async publish(data: EntityVersionBulkUpdatedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 500;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger.info(
                    `✅ EntityVersionBulkUpdated published: ${data.batchSize} updates in batch ${data.batchId}`
                );
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('❌ Failed to publish EntityVersionBulkUpdated event:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
