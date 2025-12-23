import { Subjects } from "./subjects";

export interface CustomerUpdatedEvent {
    subject: Subjects.CustomerUpdated;
    data: {
        list: CustomerUpdated[];
    };
}

export interface CustomerUpdated {
    id: string;
    uuid: string;
    user: string;
    version: number;
    name: string;
    surname: string;
    code?: string;
    email: string;
    gender?: string;
    disctrict?: string;
    city?: string;
    country?: string;
    postalCode?: string;
    identityNumber?: string;
    taxNumber?: string;
    taxOffice?: string;
    uniqueCode?: string | null;
    deleted?: boolean;
    deletionDate?: Date | null;
    fields?: Record<string, any>;
}
