import { Subjects } from './subjects';
import { EntityType, ServiceName } from '../types';
/**
 * Entity Version Updated Event
 * Her entity version güncellemesinde publish edilir (otomatik - BaseSchema hook)
 */
export interface EntityVersionUpdatedEvent {
    subject: Subjects.EntityVersionUpdated;
    data: {
        entityType: EntityType;
        entityId: string;
        service: ServiceName;
        version: number;
        previousVersion: number;
        timestamp: Date;
        userId?: string;
        metadata?: Record<string, any>;
    };
}
