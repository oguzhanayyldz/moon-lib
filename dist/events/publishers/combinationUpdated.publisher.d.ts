import { Publisher, Subjects, CombinationUpdatedEvent } from '@xmoonx/common';
export declare class CombinationUpdatedPublisher extends Publisher<CombinationUpdatedEvent> {
    subject: Subjects.CombinationUpdated;
    publish(data: CombinationUpdatedEvent['data']): Promise<void>;
}
