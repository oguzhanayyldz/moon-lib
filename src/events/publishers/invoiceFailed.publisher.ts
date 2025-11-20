import { Publisher, Subjects, InvoiceFailedEvent } from '../../common';
import { logger } from '../../services/logger.service';

export class InvoiceFailedPublisher extends Publisher<InvoiceFailedEvent> {
    subject: Subjects.InvoiceFailed = Subjects.InvoiceFailed;

    async publish(data: InvoiceFailedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000; // 1 saniye

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger.info(`[InvoiceFailedPublisher] Published ${data.list.length} failed invoice(s) for user ${data.userId}`);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('[InvoiceFailedPublisher] Failed to publish event after retries:', error);
                    throw error;
                }
                logger.warn(`[InvoiceFailedPublisher] Retry attempt ${attempt}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
