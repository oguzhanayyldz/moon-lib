import { Publisher, Subjects, BrandUpdatedEvent } from '../../common/events';
/**
 * Brand Updated Event Publisher
 * Publishes brand update events from products service
 */
export declare class BrandUpdatedPublisher extends Publisher<BrandUpdatedEvent> {
    subject: Subjects.BrandUpdated;
    publish(data: BrandUpdatedEvent['data']): Promise<void>;
}
