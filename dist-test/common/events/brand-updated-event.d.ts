import { Subjects } from './subjects';
export interface BrandUpdatedEvent {
    subject: Subjects.BrandUpdated;
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
//# sourceMappingURL=brand-updated-event.d.ts.map