import { Publisher, Subjects, OrderWorkPackageInfoBulkUpdatedEvent } from '../../common';
import { logger } from '../../services/logger.service';

export class OrderWorkPackageInfoBulkUpdatedPublisher extends Publisher<OrderWorkPackageInfoBulkUpdatedEvent> {
    subject: Subjects.OrderWorkPackageInfoBulkUpdated = Subjects.OrderWorkPackageInfoBulkUpdated;

    async publish(data: OrderWorkPackageInfoBulkUpdatedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                logger.info(`OrderWorkPackageInfoBulkUpdated event published`, {
                    workPackageId: data.workPackageId,
                    batchId: data.batchId,
                    batchSize: data.batchSize
                });
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('Failed to publish OrderWorkPackageInfoBulkUpdated event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
