import { Subjects } from './subjects';
export interface PlatformBrandSyncedEvent {
    subject: Subjects.PlatformBrandSynced;
    data: {
        syncSessionId: string;
        chunkIndex: number;
        totalChunks: number;
        integrationName: string;
        brands: Array<{
            externalId: string;
            name: string;
            code?: string;
            uniqueCode: string;
            metadata?: {
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
//# sourceMappingURL=platform-brand-synced-event.d.ts.map