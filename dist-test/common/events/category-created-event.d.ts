import { Subjects } from './subjects';
import { ResourceName } from '../types/resourceName';
export interface CategoryCreatedEvent {
    subject: Subjects.CategoryCreated;
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
//# sourceMappingURL=category-created-event.d.ts.map