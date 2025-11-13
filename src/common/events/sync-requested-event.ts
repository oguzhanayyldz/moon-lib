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
    targetServices?: ServiceName[]; // Boşsa tüm servisler sync olur
    requestedBy: string; // User ID veya 'system'
    timestamp: Date;
  };
}
