import { StockUpdateConfirmedEvent, Publisher, Subjects } from '../../common';
import { logger } from '../../services/logger.service';

/**
 * StockUpdateConfirmed Publisher (issue #567)
 *
 * Entegrasyon servisleri stok güncellemesinin platforma yazıldığını catalog'a
 * geri beslerken bu publisher'ı kullanır. IntegrationCommandResultPublisher ile
 * aynı retry stratejisini izler.
 */
export class StockUpdateConfirmedPublisher extends Publisher<StockUpdateConfirmedEvent> {
    subject: Subjects.StockUpdateConfirmed = Subjects.StockUpdateConfirmed;

    async publish(data: StockUpdateConfirmedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000; // 1 saniye

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('Failed to publish StockUpdateConfirmed event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
