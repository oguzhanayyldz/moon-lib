import { Publisher, Subjects, CategoryCreatedEvent } from '../../common/events';
/**
 * Category Created Event Publisher
 * Publishes category creation events from products service
 */
export declare class CategoryCreatedPublisher extends Publisher<CategoryCreatedEvent> {
    subject: Subjects.CategoryCreated;
    publish(data: CategoryCreatedEvent['data']): Promise<void>;
}
