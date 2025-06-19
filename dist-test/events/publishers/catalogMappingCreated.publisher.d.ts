import { Publisher, Subjects, CatalogMappingCreatedEvent } from '../../common';
export declare class CatalogMappingCreatedPublisher extends Publisher<CatalogMappingCreatedEvent> {
    subject: Subjects.CatalogMappingCreated;
    publish(data: CatalogMappingCreatedEvent['data']): Promise<void>;
}
//# sourceMappingURL=catalogMappingCreated.publisher.d.ts.map