import { Subjects } from './subjects';
import { EntityType, ServiceName } from '../types';
/**
 * Entity Version Bulk Updated Event
 * EventPublisherJob tarafından EntityVersionUpdated eventleri biriktirilerek
 * tek bir bulk mesaj olarak publish edilir
 */
export interface EntityVersionBulkUpdatedEvent {
    subject: Subjects.EntityVersionBulkUpdated;
    data: {
        /** Biriktirilen version update verileri */
        updates: Array<{
            entityType: EntityType;
            entityId: string;
            service: ServiceName;
            version: number;
            previousVersion: number;
            timestamp: Date;
            userId?: string;
            metadata?: Record<string, any>;
            parentEntity?: {
                entityType: EntityType;
                entityId: string;
            };
        }>;
        /** Batch tanımlayıcısı */
        batchId: string;
        /** Batch içindeki toplam update sayısı */
        batchSize: number;
        /** Batch oluşturulma zamanı */
        timestamp: Date;
    };
}
//# sourceMappingURL=entity-version-bulk-updated-event.d.ts.map