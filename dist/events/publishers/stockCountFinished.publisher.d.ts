import { Publisher, StockCountFinishedEvent, Subjects } from '../../common';
/**
 * Depo sayımı bitti publisher'ı (issue #637)
 *
 * Bu event kaybolursa kilit tüketici tarafta `expiresAt` dolana kadar açık
 * kalır — bu yüzden retry uygulanır, ancak defensive expiry ikinci savunma
 * hattı olarak her koşulda devrededir.
 */
export declare class StockCountFinishedPublisher extends Publisher<StockCountFinishedEvent> {
    subject: Subjects.StockCountFinished;
    publish(data: StockCountFinishedEvent['data']): Promise<void>;
}
