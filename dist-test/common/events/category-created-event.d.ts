import { Subjects } from './subjects';
export interface CategoryCreatedEvent {
    subject: Subjects.CategoryCreated;
    data: {
        id: string;
        user: string;
        name: string;
        parentCategory?: string;
        code?: string;
        source?: string;
    };
}
//# sourceMappingURL=category-created-event.d.ts.map