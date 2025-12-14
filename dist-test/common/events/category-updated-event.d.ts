import { Subjects } from './subjects';
export interface CategoryUpdatedEvent {
    subject: Subjects.CategoryUpdated;
    data: {
        id: string;
        user: string;
        name: string;
        parentCategory?: string;
        code?: string;
        source?: string;
    };
}
//# sourceMappingURL=category-updated-event.d.ts.map