import { Subjects } from "./subjects";

export interface UserConfigUpdatedEvent {
    subject: Subjects.UserConfigUpdated;
    data: {
        id: string;
        user: string;
        version: number;
        companyName?: string | null;
        sector?: string | null;
        taxNumber?: string | null;
        taxOffice?: string | null;
        billingAddress?: {
            line1: string;
            line2?: string;
            city?: string;
            district?: string;
            postalCode?: string;
            country: string;
        } | null;
        phone?: string | null;
        website?: string | null;
    };
}
