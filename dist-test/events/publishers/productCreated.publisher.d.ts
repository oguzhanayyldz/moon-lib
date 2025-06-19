import { Publisher, Subjects, ProductCreatedEvent } from '../../common';
export declare class ProductCreatedPublisher extends Publisher<ProductCreatedEvent> {
    subject: Subjects.ProductCreated;
    publish(data: ProductCreatedEvent['data']): Promise<void>;
}
//# sourceMappingURL=productCreated.publisher.d.ts.map