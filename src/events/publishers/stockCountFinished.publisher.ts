import { Publisher, StockCountFinishedEvent, Subjects } from '../../common';
import { logger } from '../../services/logger.service';

/**
 * Depo sayımı bitti publisher'ı (issue #637)
 *
 * Bu event kaybolursa kilit tüketici tarafta `expiresAt` dolana kadar açık
 * kalır — bu yüzden retry uygulanır, ancak defensive expiry ikinci savunma
 * hattı olarak her koşulda devrededir.
 */
export class StockCountFinishedPublisher extends Publisher<StockCountFinishedEvent> {
    subject: Subjects.StockCountFinished = Subjects.StockCountFinished;

    async publish(data: StockCountFinishedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000; // 1 saniye

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('Failed to publish StockCountFinished event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
