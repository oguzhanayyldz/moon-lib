import { Publisher, Subjects, RelationProductLinkUpdatedEvent } from '@xmoonx/common';
export declare class RelationProductLinkUpdatedPublisher extends Publisher<RelationProductLinkUpdatedEvent> {
    subject: Subjects.RelationProductLinkUpdated;
    publish(data: RelationProductLinkUpdatedEvent['data']): Promise<void>;
}
