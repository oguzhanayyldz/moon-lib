import { Publisher, Subjects, CategoryUpdatedEvent } from '../../common/events';
/**
 * Category Updated Event Publisher
 * Publishes category update events from products service
 */
export declare class CategoryUpdatedPublisher extends Publisher<CategoryUpdatedEvent> {
    subject: Subjects.CategoryUpdated;
    publish(data: CategoryUpdatedEvent['data']): Promise<void>;
}
