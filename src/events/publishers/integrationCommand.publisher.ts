import { IntegrationCommandEvent, Publisher, Subjects } from '../../common';
import { logger } from '../../services/logger.service';
import { sealIntegrationCommandData } from '../../utils/commandCredentials.util';

export class IntegrationCommandPublisher extends Publisher<IntegrationCommandEvent> {
    subject: Subjects.IntegrationCommand = Subjects.IntegrationCommand;

    async publish(data: IntegrationCommandEvent['data']): Promise<void> {
        // UC-1408: STAN deposuna (14 gün) düz credential / User PII yazılmasın.
        // Outbox'tan gelen (zaten mühürlü) ya da eski düz kayıtların replay'i için idempotent.
        const safeData = sealIntegrationCommandData(data);
        const maxRetries = 5;
        const retryDelay = 1000; // 1 saniye
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(safeData);
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