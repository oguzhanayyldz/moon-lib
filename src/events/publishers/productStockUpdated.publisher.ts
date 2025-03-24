import { Publisher, Subjects, ProductStockUpdatedEvent } from '@xmoonx/common';

export class ProductStockUpdatedPublisher extends Publisher<ProductStockUpdatedEvent> {
    subject: Subjects.ProductStockUpdated = Subjects.ProductStockUpdated;

    async publish(data: ProductStockUpdatedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000; // 1 saniye
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    // Son denemede de başarısız olursa loglama yap
                    console.error('Failed to publish event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}