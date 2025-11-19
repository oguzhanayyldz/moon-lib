/**
 * ProductErpIdUpdated Event Publisher
 *
 * ERP sistemlerinden (Parasut, Logo, etc.) dönen external ID'leri yayınlar.
 *
 * Kullanım:
 * ```typescript
 * const publisher = new ProductErpIdUpdatedPublisher(natsWrapper.client);
 * await publisher.publish({
 *     requestId: uuidv4(),
 *     userId: '123',
 *     list: [
 *         { id: 'prod-1', product: 'prod-1', erpId: 'parasut-123', version: 5, source: 'Parasut', sourceTimestamp: new Date() }
 *     ]
 * });
 * ```
 */
import { Publisher, Subjects, ProductErpIdUpdatedEvent } from '../../common';
export declare class ProductErpIdUpdatedPublisher extends Publisher<ProductErpIdUpdatedEvent> {
    subject: Subjects.ProductErpIdUpdated;
    publish(data: ProductErpIdUpdatedEvent['data']): Promise<void>;
}
