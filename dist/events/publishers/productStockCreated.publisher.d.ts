import { Publisher, Subjects, ProductStockCreatedEvent } from '../../common';
export declare class ProductStockCreatedPublisher extends Publisher<ProductStockCreatedEvent> {
    subject: Subjects.ProductStockCreated;
    publish(data: ProductStockCreatedEvent['data']): Promise<void>;
}
