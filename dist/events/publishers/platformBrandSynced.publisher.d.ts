import { Publisher, Subjects, PlatformBrandSyncedEvent } from '../../common/events';
/**
 * Platform Brand Synced Event Publisher
 * Publishes bulk brand sync events from integration services
 */
export declare class PlatformBrandSyncedPublisher extends Publisher<PlatformBrandSyncedEvent> {
    subject: Subjects.PlatformBrandSynced;
    publish(data: PlatformBrandSyncedEvent['data']): Promise<void>;
}
