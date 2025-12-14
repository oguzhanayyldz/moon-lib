import { Publisher, Subjects, PlatformBrandUpdatedEvent } from '../../common/events';
/**
 * Platform Brand Updated Event Publisher
 * Publishes bulk brand update events from integration services
 */
export declare class PlatformBrandUpdatedPublisher extends Publisher<PlatformBrandUpdatedEvent> {
    subject: Subjects.PlatformBrandUpdated;
    publish(data: PlatformBrandUpdatedEvent['data']): Promise<void>;
}
//# sourceMappingURL=platformBrandUpdated.publisher.d.ts.map