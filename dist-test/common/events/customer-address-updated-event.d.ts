import { AddressType } from "../types/address-type";
import { Subjects } from "./subjects";
export interface CustomerAddressUpdatedEvent {
    subject: Subjects.CustomerAddressUpdated;
    data: {
        list: CustomerAddressUpdated[];
    };
}
export interface CustomerAddressUpdated {
    id: string;
    uuid: string;
    user: string;
    customer: string;
    version: number;
    type: AddressType;
    name: string;
    surname: string;
    country?: string;
    city: string;
    district?: string;
    addressLine1: string;
    addressLine2?: string;
    postalCode?: string;
    phone?: string;
    email?: string;
    identityNumber?: string;
    taxNumber?: string;
    taxOffice?: string;
    companyName?: string;
    uniqueCode?: string | null;
    deleted?: boolean;
    deletionDate?: Date | null;
    fields?: Record<string, any>;
}
//# sourceMappingURL=customer-address-updated-event.d.ts.map