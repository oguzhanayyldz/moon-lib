import { Publisher, Subjects, InvoiceCreatedEvent } from '../../common';
import { logger } from '../../services/logger.service';

export class InvoiceCreatedPublisher extends Publisher<InvoiceCreatedEvent> {
    subject: Subjects.InvoiceCreated = Subjects.InvoiceCreated;

    async publish(data: InvoiceCreatedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000; // 1 saniye

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger.info(`[InvoiceCreatedPublisher] Published ${data.list.length} invoice(s) for user ${data.userId}`);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('[InvoiceCreatedPublisher] Failed to publish event after retries:', error);
                    throw error;
                }
                logger.warn(`[InvoiceCreatedPublisher] Retry attempt ${attempt}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
