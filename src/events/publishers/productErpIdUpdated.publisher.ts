/**
 * ProductErpIdUpdated Event Publisher
 *
 * ERP sistemlerinden (Parasut, Logo, etc.) dönen external ID'leri yayınlar.
 *
 * Kullanım:
 * ```typescript
 * const publisher = new ProductErpIdUpdatedPublisher(natsWrapper.client);
 * await publisher.publish({
 *     requestId: uuidv4(),
 *     userId: '123',
 *     list: [
 *         { id: 'prod-1', product: 'prod-1', erpId: 'parasut-123', version: 5, source: 'Parasut', sourceTimestamp: new Date() }
 *     ]
 * });
 * ```
 */
import { Publisher, Subjects, ProductErpIdUpdatedEvent } from '../../common';
import { logger } from '../../services/logger.service';

export class ProductErpIdUpdatedPublisher extends Publisher<ProductErpIdUpdatedEvent> {
    subject: Subjects.ProductErpIdUpdated = Subjects.ProductErpIdUpdated

    async publish(data: ProductErpIdUpdatedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000; // 1 saniye
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    // Son denemede de başarısız olursa loglama yap
                    logger.error('Failed to publish event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}