import { Publisher, Subjects, MarketplaceSettlementsFetchedEvent } from '../../common';
import { logger } from '../../services/logger.service';

/**
 * Pazaryeri hakedis kayitlari publisher'i (UC-1688).
 * OrderProductCostAssignedPublisher ile ayni retry davranisi.
 */
export class MarketplaceSettlementsFetchedPublisher extends Publisher<MarketplaceSettlementsFetchedEvent> {
    subject: Subjects.MarketplaceSettlementsFetched = Subjects.MarketplaceSettlementsFetched;

    async publish(data: MarketplaceSettlementsFetchedEvent['data']): Promise<void> {
        const maxRetries = 5;
        const retryDelay = 1000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await super.publish(data);
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    logger.error('Failed to publish MarketplaceSettlementsFetched event after retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
}
