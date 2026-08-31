import { Publisher, StockCountStartedEvent, Subjects } from '../../common';
/**
 * Depo sayımı başladı publisher'ı (issue #637)
 *
 * Kilit yayılımı kritik: event ulaşmazsa tüketici servisler sipariş çekmeye
 * devam eder ve sayım sırasında stok değişir. Bu yüzden NotificationCreated
 * ile aynı retry davranışı uygulanır.
 */
export declare class StockCountStartedPublisher extends Publisher<StockCountStartedEvent> {
    subject: Subjects.StockCountStarted;
    publish(data: StockCountStartedEvent['data']): Promise<void>;
}
//# sourceMappingURL=stockCountStarted.publisher.d.ts.map