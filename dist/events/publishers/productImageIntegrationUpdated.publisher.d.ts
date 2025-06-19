import { Publisher, Subjects, ProductImageIntegrationUpdatedEvent } from '../../common';
export declare class ProductImageIntegrationUpdatedPublisher extends Publisher<ProductImageIntegrationUpdatedEvent> {
    subject: Subjects.ProductImageIntegrationUpdated;
    publish(data: ProductImageIntegrationUpdatedEvent['data']): Promise<void>;
}
