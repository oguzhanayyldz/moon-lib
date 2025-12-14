import { Publisher, Subjects, PlatformCategoryUpdatedEvent } from '../../common/events';
/**
 * Platform Category Updated Event Publisher
 * Publishes bulk category update events from integration services
 */
export declare class PlatformCategoryUpdatedPublisher extends Publisher<PlatformCategoryUpdatedEvent> {
    subject: Subjects.PlatformCategoryUpdated;
    publish(data: PlatformCategoryUpdatedEvent['data']): Promise<void>;
}
//# sourceMappingURL=platformCategoryUpdated.publisher.d.ts.map