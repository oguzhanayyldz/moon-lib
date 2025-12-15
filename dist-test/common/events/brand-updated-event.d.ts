import { Subjects } from './subjects';
import { ResourceName } from '../types/resourceName';
export interface BrandUpdatedEvent {
    subject: Subjects.BrandUpdated;
    data: {
        user: string;
        brands: Array<{
            id: string;
            name: string;
            code?: string;
            source?: ResourceName;
            uniqueCode: string;
        }>;
        importedAt: string;
    };
}
//# sourceMappingURL=brand-updated-event.d.ts.map