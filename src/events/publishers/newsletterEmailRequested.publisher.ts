import { NewsletterEmailRequestedEvent, Publisher, Subjects } from '../../common';
import { logger } from '../../services/logger.service';

/**
 * Bulten maili gonderim talebi publisher'i (issue #611)
 * NotificationCreatedPublisher ile ayni retry davranisi.
 */
export class NewsletterEmailRequestedPublisher extends Publisher<NewsletterEmailRequestedEvent> {
    subject: Subjects.NewsletterEmailRequested = Subjects.NewsletterEmailRequested;

    async publish(data: NewsletterEmailRequestedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000; // 1 saniye

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('Failed to publish NewsletterEmailRequested event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
