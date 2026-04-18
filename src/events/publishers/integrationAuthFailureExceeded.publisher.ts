import { Publisher, Subjects, IntegrationAuthFailureExceededEvent } from '../../common';
import { logger } from '../../services/logger.service';

export class IntegrationAuthFailureExceededPublisher extends Publisher<IntegrationAuthFailureExceededEvent> {
    subject: Subjects.IntegrationAuthFailureExceeded = Subjects.IntegrationAuthFailureExceeded;

    async publish(data: IntegrationAuthFailureExceededEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger.info(`[IntegrationAuthFailureExceededPublisher] Published for user ${data.userId}, integration ${data.integrationName}, count ${data.failureCount}`);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('[IntegrationAuthFailureExceededPublisher] Failed to publish event after retries:', error);
                    throw error;
                }
                logger.warn(`[IntegrationAuthFailureExceededPublisher] Retry attempt ${attempt}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
