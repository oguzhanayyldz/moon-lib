import { Subjects } from './subjects';
import { EntityType, ServiceName } from '../types';
/**
 * Sync Requested Event
 * Manuel veya otomatik sync tetiklendiğinde publish edilir
 */
export interface SyncRequestedEvent {
    subject: Subjects.SyncRequested;
    data: {
        entityType: EntityType;
        entityId: string;
        targetServices?: ServiceName[];
        requestedBy: string;
        timestamp: Date;
    };
}
//# sourceMappingURL=sync-requested-event.d.ts.map