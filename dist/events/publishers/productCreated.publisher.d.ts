import { Publisher, Subjects, ProductCreatedEvent } from '@xmoonx/common';
export declare class ProductCreatedPublisher extends Publisher<ProductCreatedEvent> {
    subject: Subjects.ProductCreated;
    publish(data: ProductCreatedEvent['data']): Promise<void>;
}
