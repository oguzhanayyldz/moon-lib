import { Publisher, StockCountStartedEvent, Subjects } from '../../common';
import { logger } from '../../services/logger.service';

/**
 * Depo sayımı başladı publisher'ı (issue #637)
 *
 * Kilit yayılımı kritik: event ulaşmazsa tüketici servisler sipariş çekmeye
 * devam eder ve sayım sırasında stok değişir. Bu yüzden NotificationCreated
 * ile aynı retry davranışı uygulanır.
 */
export class StockCountStartedPublisher extends Publisher<StockCountStartedEvent> {
    subject: Subjects.StockCountStarted = Subjects.StockCountStarted;

    async publish(data: StockCountStartedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000; // 1 saniye

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('Failed to publish StockCountStarted event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
