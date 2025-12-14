import { Subjects } from './subjects';
export interface PlatformCategoryUpdatedEvent {
    subject: Subjects.PlatformCategoryUpdated;
    data: {
        integrationName: string;
        categories: Array<{
            externalId: string;
            name: string;
            parentId?: string;
            code?: string;
            level?: number;
            metadata?: {
                path?: string;
                isLeaf?: boolean;
                displayOrder?: number;
                [key: string]: any;
            };
        }>;
        lastSyncedAt: string;
    };
}
//# sourceMappingURL=platform-category-updated-event.d.ts.map