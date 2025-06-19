import { FixStatus } from "../types/fix-status";
import { UserRole } from "../types/user-role";
import { Subjects } from "./subjects";
export interface UserCreatedEvent {
    subject: Subjects.UserCreated;
    data: {
        id: string;
        uuid: string;
        version: number;
        name: string;
        surname: string;
        email: string;
        status: FixStatus;
        role: UserRole;
        parentUser: string | null;
        uniqueCode?: string | null;
        creationDate?: Date;
        updatedOn?: Date;
    };
}
//# sourceMappingURL=user-created-event.d.ts.map