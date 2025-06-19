import { Publisher, Subjects, ProductStockUpdatedEvent } from '../../common';
export declare class ProductStockUpdatedPublisher extends Publisher<ProductStockUpdatedEvent> {
    subject: Subjects.ProductStockUpdated;
    publish(data: ProductStockUpdatedEvent['data']): Promise<void>;
}
