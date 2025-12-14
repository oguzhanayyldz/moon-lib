import { Subjects } from './subjects';

export interface PlatformBrandUpdatedEvent {
  subject: Subjects.PlatformBrandUpdated;
  data: {
    integrationName: string;
    brands: Array<{
      externalId: string;
      name: string;
      code?: string;
      metadata?: {
        displayOrder?: number;
        [key: string]: any;
      };
    }>;
    lastSyncedAt: string;
  };
}
