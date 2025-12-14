import { Subjects } from './subjects';
export interface BrandUpdatedEvent {
    subject: Subjects.BrandUpdated;
    data: {
        id: string;
        user: string;
        name: string;
        code?: string;
        source?: string;
    };
}
