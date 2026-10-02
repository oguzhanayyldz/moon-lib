import { ProductPreMatchUpdatedEvent, Publisher, Subjects } from '../../common';
/**
 * ProductPreMatchUpdated Publisher (TASK-MURHHI9UCDMZW)
 *
 * Entegrasyon servisleri "Eşleşen" ürünlerin eşleşme verisini ve karar durumunu catalog'a
 * geri beslerken bu publisher'ı kullanır. IntegrationCommandResultPublisher ile
 * aynı retry stratejisini izler.
 */
export declare class ProductPreMatchUpdatedPublisher extends Publisher<ProductPreMatchUpdatedEvent> {
    subject: Subjects.ProductPreMatchUpdated;
    publish(data: ProductPreMatchUpdatedEvent['data']): Promise<void>;
}
//# sourceMappingURL=productPreMatchUpdated.publisher.d.ts.map