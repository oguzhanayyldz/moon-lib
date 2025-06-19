import { Publisher, Subjects, ProductIntegrationSyncedEvent } from '../../common';
export declare class ProductIntegrationSyncedPublisher extends Publisher<ProductIntegrationSyncedEvent> {
    subject: Subjects.ProductIntegrationSynced;
    publish(data: ProductIntegrationSyncedEvent['data']): Promise<void>;
}
