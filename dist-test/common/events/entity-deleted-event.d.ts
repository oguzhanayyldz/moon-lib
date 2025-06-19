import { Subjects } from "./subjects";
export interface EntityDeletedEvent {
    subject: Subjects.EntityDeleted;
    data: {
        entity: string;
        list: {
            id: string;
            entity: string;
            timestamp: string;
            userId?: string;
            metadata?: any;
        }[];
    };
}
//# sourceMappingURL=entity-deleted-event.d.ts.map