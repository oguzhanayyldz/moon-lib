import { Publisher, Subjects, EntityDeletedEvent } from '../../common';
export declare class EntityDeletedPublisher extends Publisher<EntityDeletedEvent> {
    subject: Subjects.EntityDeleted;
    publish(data: EntityDeletedEvent['data']): Promise<void>;
}
