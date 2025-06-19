import { Publisher, Subjects, CombinationUpdatedEvent } from '../../common';
export declare class CombinationUpdatedPublisher extends Publisher<CombinationUpdatedEvent> {
    subject: Subjects.CombinationUpdated;
    publish(data: CombinationUpdatedEvent['data']): Promise<void>;
}
//# sourceMappingURL=combinationUpdated.publisher.d.ts.map