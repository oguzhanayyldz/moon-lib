import { Publisher, Subjects, ProductUpdatedEvent } from '../../common';
export declare class ProductUpdatedPublisher extends Publisher<ProductUpdatedEvent> {
    subject: Subjects.ProductUpdated;
    publish(data: ProductUpdatedEvent['data']): Promise<void>;
}
