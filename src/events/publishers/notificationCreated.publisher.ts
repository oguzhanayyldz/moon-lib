import { NotificationCreatedEvent, Publisher, Subjects } from '../../common';
import { logger } from '../../services/logger.service';

export class NotificationCreatedPublisher extends Publisher<NotificationCreatedEvent> {
  subject: Subjects.NotificationCreated = Subjects.NotificationCreated;

  async publish(data: NotificationCreatedEvent['data']): Promise<void> {
    const maxRetries = 5;
    const retryDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await super.publish(data);
        return;
      } catch (error) {
        if (attempt === maxRetries) {
          logger.error('Failed to publish NotificationCreated event after retries:', error);
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }
  }
}
