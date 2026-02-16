import { Subjects } from './subjects';
export interface PlatformCategorySyncedEvent {
    subject: Subjects.PlatformCategorySynced;
    data: {
        syncSessionId: string;
        chunkIndex: number;
        totalChunks: number;
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
            changeType?: 'new' | 'updated';
        }>;
        deletedExternalIds?: string[];
        syncedAt: string;
        isLastChunk: boolean;
    };
}
//# sourceMappingURL=platform-category-synced-event.d.ts.map