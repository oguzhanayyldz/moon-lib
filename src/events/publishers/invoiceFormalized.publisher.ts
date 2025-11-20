import { Publisher, Subjects, InvoiceFormalizedEvent } from '../../common';
import { logger } from '../../services/logger.service';

export class InvoiceFormalizedPublisher extends Publisher<InvoiceFormalizedEvent> {
    subject: Subjects.InvoiceFormalized = Subjects.InvoiceFormalized;

    async publish(data: InvoiceFormalizedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000; // 1 saniye

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger.info(`[InvoiceFormalizedPublisher] Published ${data.list.length} formalized invoice(s) for user ${data.userId}`);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('[InvoiceFormalizedPublisher] Failed to publish event after retries:', error);
                    throw error;
                }
                logger.warn(`[InvoiceFormalizedPublisher] Retry attempt ${attempt}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
