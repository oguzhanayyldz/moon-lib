import { Publisher, Subjects, PriceProcessingCompletedEvent } from '../../common';
export declare class PriceProcessingCompletedPublisher extends Publisher<PriceProcessingCompletedEvent> {
    subject: Subjects.PriceProcessingCompleted;
    publish(data: PriceProcessingCompletedEvent['data']): Promise<void>;
}
//# sourceMappingURL=priceProcessingCompleted.publisher.d.ts.map