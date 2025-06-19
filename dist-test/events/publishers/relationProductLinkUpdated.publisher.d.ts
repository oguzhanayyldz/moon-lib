import { Publisher, Subjects, RelationProductLinkUpdatedEvent } from '../../common';
export declare class RelationProductLinkUpdatedPublisher extends Publisher<RelationProductLinkUpdatedEvent> {
    subject: Subjects.RelationProductLinkUpdated;
    publish(data: RelationProductLinkUpdatedEvent['data']): Promise<void>;
}
//# sourceMappingURL=relationProductLinkUpdated.publisher.d.ts.map