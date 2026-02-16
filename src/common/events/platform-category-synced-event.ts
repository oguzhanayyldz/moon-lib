import { Subjects } from './subjects';

export interface PlatformCategorySyncedEvent {
  subject: Subjects.PlatformCategorySynced;
  data: {
    syncSessionId: string;     // UUID for this sync session
    chunkIndex: number;         // Index of this chunk (0, 1, 2...)
    totalChunks: number;        // Total number of chunks in this sync
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
      changeType?: 'new' | 'updated';  // Delta sync: Değişiklik türü
    }>;
    deletedExternalIds?: string[];  // Delta sync: Silinen kayıt ID'leri
    syncedAt: string;
    isLastChunk: boolean;
  };
}
