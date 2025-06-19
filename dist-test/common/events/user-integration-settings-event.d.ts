import { Subjects } from "./subjects";
export interface UserIntegrationSettingsEvent {
    subject: Subjects.UserIntegrationSettings;
    data: {
        id: string;
        uuid: string;
        user: string;
        version: number;
        integration: string;
        credentials: {
            [key: string]: string;
        };
        active: boolean;
        lastSync?: Date;
        uniqueCode?: string | null;
        deleted?: boolean;
        deletionDate?: Date | null;
    };
}
//# sourceMappingURL=user-integration-settings-event.d.ts.map