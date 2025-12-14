import { Subjects } from './subjects';
export interface BrandCreatedEvent {
    subject: Subjects.BrandCreated;
    data: {
        user: string;
        brands: Array<{
            id: string;
            name: string;
            code?: string;
            source?: string;
            uniqueCode: string;
        }>;
        importedAt: string;
    };
}
//# sourceMappingURL=brand-created-event.d.ts.map