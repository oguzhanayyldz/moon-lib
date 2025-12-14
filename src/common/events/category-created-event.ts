import { Subjects } from './subjects';

export interface CategoryCreatedEvent {
  subject: Subjects.CategoryCreated;
  data: {
    user: string;
    categories: Array<{
      id: string;
      name: string;
      parentCategory?: string;
      code?: string;
      source?: string;
    }>;
    importedAt: string;
  };
}
