import { ResourceName } from "../types/resourceName";
import { Subjects } from "./subjects";
export interface IntegrationCommandEvent {
    subject: Subjects.IntegrationCommand;
    data: {
        requestId: string;
        user: string;
        platform: ResourceName;
        command: string;
        params?: any;
        payload?: {
            credentials: Record<string, any>;
            integrationId: string;
        };
        replyTo?: any;
    };
}
