import { Publisher, Subjects, OrderProductStockUpdatedEvent } from '../../common';
import { logger } from '../../services/logger.service';

/**
 * OrderProductStockUpdated Publisher
 * OrderProduct'ların stok rezervasyon durumları güncellendiğinde bu publisher kullanılır
 */
export class OrderProductStockUpdatedPublisher extends Publisher<OrderProductStockUpdatedEvent> {
    subject: Subjects.OrderProductUpdated = Subjects.OrderProductUpdated;

    async publish(data: OrderProductStockUpdatedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000; // 1 saniye

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('Failed to publish OrderProductUpdated event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
