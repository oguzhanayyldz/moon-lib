import { Publisher, Subjects, OrderProductCostAssignedEvent } from '../../common';
import { logger } from '../../services/logger.service';

/**
 * Siparis kalemi maliyet atama publisher'i (issue #683)
 * ProductCostUpdatedPublisher ile ayni retry davranisi.
 */
export class OrderProductCostAssignedPublisher extends Publisher<OrderProductCostAssignedEvent> {
    subject: Subjects.OrderProductCostAssigned = Subjects.OrderProductCostAssigned;

    async publish(data: OrderProductCostAssignedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000; // 1 saniye

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('Failed to publish OrderProductCostAssigned event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
