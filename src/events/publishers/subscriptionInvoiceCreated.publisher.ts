import { Publisher, Subjects, SubscriptionInvoiceCreatedEvent } from '../../common';
import { logger } from '../../services/logger.service';

export class SubscriptionInvoiceCreatedPublisher extends Publisher<SubscriptionInvoiceCreatedEvent> {
    subject: Subjects.SubscriptionInvoiceCreated = Subjects.SubscriptionInvoiceCreated;

    async publish(data: SubscriptionInvoiceCreatedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger.info(`[SubscriptionInvoiceCreatedPublisher] Published subscription invoice for user ${data.user}`);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('[SubscriptionInvoiceCreatedPublisher] Failed to publish event after retries:', error);
                    throw error;
                }
                logger.warn(`[SubscriptionInvoiceCreatedPublisher] Retry attempt ${attempt}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
