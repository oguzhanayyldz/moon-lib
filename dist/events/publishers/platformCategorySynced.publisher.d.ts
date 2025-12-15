import { Publisher, Subjects, PlatformCategorySyncedEvent } from '../../common/events';
/**
 * Platform Category Synced Event Publisher
 * Publishes bulk category sync events from integration services
 */
export declare class PlatformCategorySyncedPublisher extends Publisher<PlatformCategorySyncedEvent> {
    subject: Subjects.PlatformCategorySynced;
    publish(data: PlatformCategorySyncedEvent['data']): Promise<void>;
}
