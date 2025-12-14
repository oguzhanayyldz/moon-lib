import { Subjects } from './subjects';
export interface CategoryUpdatedEvent {
    subject: Subjects.CategoryUpdated;
    data: {
        user: string;
        categories: Array<{
            id: string;
            name: string;
            parentCategory?: string;
            code?: string;
            source?: string;
            uniqueCode: string;
        }>;
        importedAt: string;
    };
}
