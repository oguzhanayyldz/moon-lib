import { Publisher, Subjects, SyncRequestedEvent } from '../../common';
/**
 * Sync Requested Publisher
 * Manuel veya otomatik sync tetiklendiğinde kullanılır
 */
export declare class SyncRequestedPublisher extends Publisher<SyncRequestedEvent> {
    subject: Subjects.SyncRequested;
    publish(data: SyncRequestedEvent['data']): Promise<void>;
}
//# sourceMappingURL=syncRequested.publisher.d.ts.map