import { Publisher, Subjects, CombinationCreatedEvent } from '../../common';
export declare class CombinationCreatedPublisher extends Publisher<CombinationCreatedEvent> {
    subject: Subjects.CombinationCreated;
    publish(data: CombinationCreatedEvent['data']): Promise<void>;
}
