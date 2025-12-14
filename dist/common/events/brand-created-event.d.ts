import { Subjects } from './subjects';
export interface BrandCreatedEvent {
    subject: Subjects.BrandCreated;
    data: {
        id: string;
        user: string;
        name: string;
        code?: string;
        source?: string;
    };
}
