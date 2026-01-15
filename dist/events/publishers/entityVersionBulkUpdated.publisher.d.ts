import { Publisher, Subjects, EntityVersionBulkUpdatedEvent } from '../../common';
/**
 * Entity Version Bulk Updated Publisher
 * EventPublisherJob tarafından biriktirilen EntityVersionUpdated eventlerini
 * tek bir bulk mesaj olarak publish eder
 */
export declare class EntityVersionBulkUpdatedPublisher extends Publisher<EntityVersionBulkUpdatedEvent> {
    subject: Subjects.EntityVersionBulkUpdated;
    publish(data: EntityVersionBulkUpdatedEvent['data']): Promise<void>;
}
