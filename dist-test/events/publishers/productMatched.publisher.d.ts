import { Publisher, Subjects, ProductMatchedEvent } from '../../common';
export declare class ProductMatchedPublisher extends Publisher<ProductMatchedEvent> {
    subject: Subjects.ProductMatched;
    publish(data: ProductMatchedEvent['data']): Promise<void>;
}
//# sourceMappingURL=productMatched.publisher.d.ts.map