import { Publisher, Subjects, SyncRequestedEvent } from '../../common';
import { logger } from '../../services/logger.service';

/**
 * Sync Requested Publisher
 * Manuel veya otomatik sync tetiklendiğinde kullanılır
 */
export class SyncRequestedPublisher extends Publisher<SyncRequestedEvent> {
    subject: Subjects.SyncRequested = Subjects.SyncRequested;

    async publish(data: SyncRequestedEvent['data']): Promise<void> {
        const maxRetries = 3;
        const retryDelay = 500;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger.info(`✅ SyncRequested published: ${data.entityType}/${data.entityId} by ${data.requestedBy}`);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('❌ Failed to publish SyncRequested event:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
