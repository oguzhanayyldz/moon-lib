import { Subjects } from './subjects';

export interface PlatformCategoryCreatedEvent {
  subject: Subjects.PlatformCategoryCreated;
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
