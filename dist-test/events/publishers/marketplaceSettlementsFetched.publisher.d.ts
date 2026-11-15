import { Publisher, Subjects, MarketplaceSettlementsFetchedEvent } from '../../common';
/**
 * Pazaryeri hakedis kayitlari publisher'i (UC-1688).
 * OrderProductCostAssignedPublisher ile ayni retry davranisi.
 */
export declare class MarketplaceSettlementsFetchedPublisher extends Publisher<MarketplaceSettlementsFetchedEvent> {
    subject: Subjects.MarketplaceSettlementsFetched;
    publish(data: MarketplaceSettlementsFetchedEvent['data']): Promise<void>;
}
//# sourceMappingURL=marketplaceSettlementsFetched.publisher.d.ts.map