import { Publisher, Subjects, DeleteProductImagesEvent } from '@xmoonx/common';

export class DeleteProductImagesPublisher extends Publisher<DeleteProductImagesEvent> {
    subject: Subjects.DeleteProductImages = Subjects.DeleteProductImages;

    async publish(data: DeleteProductImagesEvent['data']): Promise<void> {
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