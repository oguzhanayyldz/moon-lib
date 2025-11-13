import { Publisher, Subjects, EntityVersionUpdatedEvent } from '../../common';
import { logger } from '../../services/logger.service';

/**
 * Entity Version Updated Publisher
 * BaseSchema hook tarafından otomatik tetiklenir
 */
export class EntityVersionUpdatedPublisher extends Publisher<EntityVersionUpdatedEvent> {
    subject: Subjects.EntityVersionUpdated = Subjects.EntityVersionUpdated;

    async publish(data: EntityVersionUpdatedEvent['data']): Promise<void> {
        const maxRetries = 3;
        const retryDelay = 500;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger.debug(`✅ EntityVersionUpdated published: ${data.entityType}/${data.entityId} v${data.version} from ${data.service}`);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('❌ Failed to publish EntityVersionUpdated event:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
