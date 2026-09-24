import { Publisher, Subjects, UserSessionsRevokedEvent } from '../../common';
import { logger } from '../../services/logger.service';

/**
 * Hesap duzeyinde oturum iptali publisher'i (TASK-MUFJ7F2IFKC77)
 * NotificationCreatedPublisher ile ayni retry davranisi.
 */
export class UserSessionsRevokedPublisher extends Publisher<UserSessionsRevokedEvent> {
    subject: Subjects.UserSessionsRevoked = Subjects.UserSessionsRevoked;

    async publish(data: UserSessionsRevokedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000; // 1 saniye

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('Failed to publish UserSessionsRevoked event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
