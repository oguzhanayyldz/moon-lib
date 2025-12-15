import { Subjects } from './subjects';
export interface PlatformCategorySyncedEvent {
    subject: Subjects.PlatformCategorySynced;
    data: {
        integrationName: string;
        categories: Array<{
            externalId: string;
            name: string;
            parentId?: string;
            code?: string;
            level?: number;
            uniqueCode: string;
            metadata?: {
                path?: string;
                isLeaf?: boolean;
                displayOrder?: number;
                [key: string]: any;
            };
        }>;
        syncedAt: string;
        isLastChunk: boolean;
    };
}
