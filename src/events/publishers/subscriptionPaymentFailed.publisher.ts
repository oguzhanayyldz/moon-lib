import { Publisher, Subjects, SubscriptionPaymentFailedEvent } from '../../common';
import { logger } from '../../services/logger.service';

export class SubscriptionPaymentFailedPublisher extends Publisher<SubscriptionPaymentFailedEvent> {
    subject: Subjects.SubscriptionPaymentFailed = Subjects.SubscriptionPaymentFailed;

    async publish(data: SubscriptionPaymentFailedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger.info(`[SubscriptionPaymentFailedPublisher] Published payment failure ${data.paymentId} for user ${data.userId}`);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('[SubscriptionPaymentFailedPublisher] Failed to publish event after retries:', error);
                    throw error;
                }
                logger.warn(`[SubscriptionPaymentFailedPublisher] Retry attempt ${attempt}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
