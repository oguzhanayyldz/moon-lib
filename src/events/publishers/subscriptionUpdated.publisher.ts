import { Publisher, Subjects, SubscriptionUpdatedEvent } from '../../common';
import { logger } from '../../services/logger.service';

export class SubscriptionUpdatedPublisher extends Publisher<SubscriptionUpdatedEvent> {
    subject: Subjects.SubscriptionUpdated = Subjects.SubscriptionUpdated;

    async publish(data: SubscriptionUpdatedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger.info(`[SubscriptionUpdatedPublisher] Published subscription ${data.action} for user ${data.userId}`);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('[SubscriptionUpdatedPublisher] Failed to publish event after retries:', error);
                    throw error;
                }
                logger.warn(`[SubscriptionUpdatedPublisher] Retry attempt ${attempt}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
