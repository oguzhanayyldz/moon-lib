import { Publisher, Subjects, UserConfigUpdatedEvent } from '../../common';
import { logger } from '../../services/logger.service';

export class UserConfigUpdatedPublisher extends Publisher<UserConfigUpdatedEvent> {
    subject: Subjects.UserConfigUpdated = Subjects.UserConfigUpdated;

    async publish(data: UserConfigUpdatedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('Failed to publish UserConfigUpdated event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
