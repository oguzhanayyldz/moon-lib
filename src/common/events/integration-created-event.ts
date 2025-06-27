import { FixStatus } from "../types/fix-status";
import { IntegrationType } from "../types/integration-type";
import { UserRole } from "../types/user-role";
import { Subjects } from "./subjects";

export interface IntegrationCreatedEvent {
    subject: Subjects.IntegrationCreated;
    data: {
        id: string;
        uuid: string;
        version: number;
        name: string;
        description: string;
        url?: string;
        image?: string;
        type?: IntegrationType; // Assuming IntegrationType is a string enum
        position?: number;
        status?: FixStatus; // Assuming FixStatus is a string enum
        uniqueCode?: string | null;
        creationDate?: Date;
        updatedOn?: Date;
        deleted?: boolean;
        deletionDate?: Date | null;
    };
}
