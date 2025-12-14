import { Publisher, Subjects, BrandCreatedEvent } from '../../common/events';
/**
 * Brand Created Event Publisher
 * Publishes brand creation events from products service
 */
export declare class BrandCreatedPublisher extends Publisher<BrandCreatedEvent> {
    subject: Subjects.BrandCreated;
    publish(data: BrandCreatedEvent['data']): Promise<void>;
}
//# sourceMappingURL=brandCreated.publisher.d.ts.map