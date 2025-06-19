import { Publisher, Subjects, ProductPriceUpdatedEvent } from '../../common';
export declare class ProductPriceUpdatedPublisher extends Publisher<ProductPriceUpdatedEvent> {
    subject: Subjects.ProductPriceUpdated;
    publish(data: ProductPriceUpdatedEvent['data']): Promise<void>;
}
//# sourceMappingURL=productPriceUpdated.publisher.d.ts.map