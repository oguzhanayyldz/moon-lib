import { Subjects } from './subjects';
export interface PlatformBrandSyncedEvent {
    subject: Subjects.PlatformBrandSynced;
    data: {
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
//# sourceMappingURL=platform-brand-synced-event.d.ts.map