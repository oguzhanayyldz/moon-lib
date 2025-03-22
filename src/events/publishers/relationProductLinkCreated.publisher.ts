import { Publisher, Subjects, RelationProductLinkCreatedEvent } from '@xmoonx/common';

export class RelationProductLinkCreatedPublisher extends Publisher<RelationProductLinkCreatedEvent> {
    subject: Subjects.RelationProductLinkCreated = Subjects.RelationProductLinkCreated;

    async publish(data: RelationProductLinkCreatedEvent['data']): Promise<void> {
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