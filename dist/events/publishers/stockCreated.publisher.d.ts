import { Publisher, Subjects, StockCreatedEvent } from '../../common';
export declare class StockCreatedPublisher extends Publisher<StockCreatedEvent> {
    subject: Subjects.StockCreated;
    publish(data: StockCreatedEvent['data']): Promise<void>;
}
