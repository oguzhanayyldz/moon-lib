import { Subjects } from './subjects';
import { ResourceName } from '../types/resourceName';

export interface BrandCreatedEvent {
  subject: Subjects.BrandCreated;
  data: {
    user: string;
    brands: Array<{
      id: string;
      name: string;
      code?: string;
      source?: ResourceName;
      uniqueCode: string;
    }>;
    importedAt: string;
  };
}
