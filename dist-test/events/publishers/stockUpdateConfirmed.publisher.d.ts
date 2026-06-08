import { StockUpdateConfirmedEvent, Publisher, Subjects } from '../../common';
/**
 * StockUpdateConfirmed Publisher (issue #567)
 *
 * Entegrasyon servisleri stok güncellemesinin platforma yazıldığını catalog'a
 * geri beslerken bu publisher'ı kullanır. IntegrationCommandResultPublisher ile
 * aynı retry stratejisini izler.
 */
export declare class StockUpdateConfirmedPublisher extends Publisher<StockUpdateConfirmedEvent> {
    subject: Subjects.StockUpdateConfirmed;
    publish(data: StockUpdateConfirmedEvent['data']): Promise<void>;
}
//# sourceMappingURL=stockUpdateConfirmed.publisher.d.ts.map