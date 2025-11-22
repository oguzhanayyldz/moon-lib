import { Publisher, Subjects, InvoiceUpdatedEvent } from '../../common';
import { logger } from '../../services/logger.service';

export class InvoiceUpdatedPublisher extends Publisher<InvoiceUpdatedEvent> {
    subject: Subjects.InvoiceUpdated = Subjects.InvoiceUpdated;

    async publish(data: InvoiceUpdatedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000; // 1 saniye

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger.info(`[InvoiceUpdatedPublisher] Published ${data.list.length} invoice update(s) for user ${data.userId}`);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('[InvoiceUpdatedPublisher] Failed to publish event after retries:', error);
                    throw error;
                }
                logger.warn(`[InvoiceUpdatedPublisher] Retry attempt ${attempt}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
