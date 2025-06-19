import { FixStatus } from "../types/fix-status";
import { IntegrationType } from "../types/integration-type";
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
        type?: IntegrationType;
        position?: number;
        status?: FixStatus;
        uniqueCode?: string | null;
        creationDate?: Date;
        updatedOn?: Date;
        deleted?: boolean;
        deletionDate?: Date | null;
    };
}
//# sourceMappingURL=integration-created-event.d.ts.map