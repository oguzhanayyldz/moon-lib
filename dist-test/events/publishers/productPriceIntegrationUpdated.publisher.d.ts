import { Publisher, Subjects, ProductPriceIntegrationUpdatedEvent } from '../../common';
export declare class ProductPriceIntegrationUpdatedPublisher extends Publisher<ProductPriceIntegrationUpdatedEvent> {
    subject: Subjects.ProductPriceIntegrationUpdated;
    publish(data: ProductPriceIntegrationUpdatedEvent['data']): Promise<void>;
}
//# sourceMappingURL=productPriceIntegrationUpdated.publisher.d.ts.map