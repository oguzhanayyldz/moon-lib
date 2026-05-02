import { Publisher, Subjects, ProductStockBulkUpdatedEvent } from '../../common';
export declare class ProductStockBulkUpdatedPublisher extends Publisher<ProductStockBulkUpdatedEvent> {
    subject: Subjects.ProductStockBulkUpdated;
    publish(data: ProductStockBulkUpdatedEvent['data']): Promise<void>;
}
//# sourceMappingURL=productStockBulkUpdated.publisher.d.ts.map