import { Subjects } from './subjects';

export interface PlatformBrandSyncedEvent {
  subject: Subjects.PlatformBrandSynced;
  data: {
    syncSessionId: string;     // UUID for this sync session
    chunkIndex: number;         // Index of this chunk (0, 1, 2...)
    totalChunks: number;        // Total number of chunks in this sync
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
      changeType?: 'new' | 'updated';  // Delta sync: Değişiklik türü
    }>;
    deletedExternalIds?: string[];  // Delta sync: Silinen kayıt ID'leri
    syncedAt: string;
    isLastChunk: boolean;
  };
}
