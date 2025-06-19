import { Publisher, Subjects, StockUpdatedEvent } from '../../common';
export declare class StockUpdatedPublisher extends Publisher<StockUpdatedEvent> {
    subject: Subjects.StockUpdated;
    publish(data: StockUpdatedEvent['data']): Promise<void>;
}
