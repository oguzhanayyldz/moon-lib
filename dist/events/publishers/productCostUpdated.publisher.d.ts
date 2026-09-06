import { Publisher, Subjects, ProductCostUpdatedEvent } from '../../common';
/**
 * Urun maliyeti guncelleme publisher'i (issue #638)
 * ProductPriceUpdatedPublisher ile ayni retry davranisi.
 */
export declare class ProductCostUpdatedPublisher extends Publisher<ProductCostUpdatedEvent> {
    subject: Subjects.ProductCostUpdated;
    publish(data: ProductCostUpdatedEvent['data']): Promise<void>;
}
