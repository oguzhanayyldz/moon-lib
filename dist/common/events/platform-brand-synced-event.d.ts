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
        }>;
        syncedAt: string;
        isLastChunk: boolean;
    };
}
