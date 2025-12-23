import { Publisher, Subjects, CatalogMappingUpdatedEvent } from '../../common';
export declare class CatalogMappingUpdatedPublisher extends Publisher<CatalogMappingUpdatedEvent> {
    subject: Subjects.CatalogMappingUpdated;
    publish(data: CatalogMappingUpdatedEvent['data']): Promise<void>;
}
