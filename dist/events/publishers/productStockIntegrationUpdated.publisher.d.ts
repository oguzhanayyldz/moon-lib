import { Publisher, Subjects, ProductStockIntegrationUpdatedEvent } from '../../common';
export declare class ProductStockIntegrationUpdatedPublisher extends Publisher<ProductStockIntegrationUpdatedEvent> {
    subject: Subjects.ProductStockIntegrationUpdated;
    publish(data: ProductStockIntegrationUpdatedEvent['data']): Promise<void>;
}
