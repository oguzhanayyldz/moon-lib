import { Publisher, Subjects, PlatformBrandCreatedEvent } from '../../common/events';
/**
 * Platform Brand Created Event Publisher
 * Publishes bulk brand creation events from integration services
 */
export declare class PlatformBrandCreatedPublisher extends Publisher<PlatformBrandCreatedEvent> {
    subject: Subjects.PlatformBrandCreated;
    publish(data: PlatformBrandCreatedEvent['data']): Promise<void>;
}
//# sourceMappingURL=platformBrandCreated.publisher.d.ts.map