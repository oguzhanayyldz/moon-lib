import { Publisher, Subjects, PlatformCategoryCreatedEvent } from '../../common/events';
/**
 * Platform Category Created Event Publisher
 * Publishes bulk category creation events from integration services
 */
export declare class PlatformCategoryCreatedPublisher extends Publisher<PlatformCategoryCreatedEvent> {
    subject: Subjects.PlatformCategoryCreated;
    publish(data: PlatformCategoryCreatedEvent['data']): Promise<void>;
}
