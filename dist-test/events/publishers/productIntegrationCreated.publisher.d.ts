import { Publisher, Subjects, ProductIntegrationCreatedEvent } from '../../common';
export declare class ProductIntegrationCreatedPublisher extends Publisher<ProductIntegrationCreatedEvent> {
    subject: Subjects.ProductIntegrationCreated;
    publish(data: ProductIntegrationCreatedEvent['data']): Promise<void>;
}
//# sourceMappingURL=productIntegrationCreated.publisher.d.ts.map