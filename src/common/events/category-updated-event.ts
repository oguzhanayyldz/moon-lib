import { Subjects } from './subjects';
import { ResourceName } from '../types/resourceName';

export interface CategoryUpdatedEvent {
  subject: Subjects.CategoryUpdated;
  data: {
    user: string;
    categories: Array<{
      id: string;
      name: string;
      parentCategory?: string;
      code?: string;
      source?: ResourceName;
      uniqueCode: string;
    }>;
    importedAt: string;
  };
}
