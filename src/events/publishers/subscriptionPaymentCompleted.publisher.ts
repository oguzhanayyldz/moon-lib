import { Publisher, Subjects, SubscriptionPaymentCompletedEvent } from '../../common';
import { logger } from '../../services/logger.service';

export class SubscriptionPaymentCompletedPublisher extends Publisher<SubscriptionPaymentCompletedEvent> {
    subject: Subjects.SubscriptionPaymentCompleted = Subjects.SubscriptionPaymentCompleted;

    async publish(data: SubscriptionPaymentCompletedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger.info(`[SubscriptionPaymentCompletedPublisher] Published payment ${data.paymentId} for user ${data.userId}`);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('[SubscriptionPaymentCompletedPublisher] Failed to publish event after retries:', error);
                    throw error;
                }
                logger.warn(`[SubscriptionPaymentCompletedPublisher] Retry attempt ${attempt}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
