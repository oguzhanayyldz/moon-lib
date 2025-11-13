import { Publisher, Subjects, EntityVersionUpdatedEvent } from '../../common';
/**
 * Entity Version Updated Publisher
 * BaseSchema hook tarafından otomatik tetiklenir
 */
export declare class EntityVersionUpdatedPublisher extends Publisher<EntityVersionUpdatedEvent> {
    subject: Subjects.EntityVersionUpdated;
    publish(data: EntityVersionUpdatedEvent['data']): Promise<void>;
}
//# sourceMappingURL=entityVersionUpdated.publisher.d.ts.map