import { Publisher, Subjects, RelationProductLinkCreatedEvent } from '@xmoonx/common';
export declare class RelationProductLinkCreatedPublisher extends Publisher<RelationProductLinkCreatedEvent> {
    subject: Subjects.RelationProductLinkCreated;
    publish(data: RelationProductLinkCreatedEvent['data']): Promise<void>;
}
