import { ResourceName } from "../types/resourceName";
import { Subjects } from "./subjects";
import { CommandDispatchInfo } from "../constants/command-item-summary";
export interface IntegrationCommandEvent {
    subject: Subjects.IntegrationCommand;
    data: {
        requestId: string;
        user: string;
        platform: ResourceName;
        command: string;
        integration?: string;
        params?: any;
        payload?: {
            credentials: Record<string, any>;
            integrationId: string;
        };
        replyTo?: any;
        /** Gönderim bağlamı (Karar 5): yalnız yayınlayan servisin outbox'ında okunur, yönlendirici platforma iletmez */
        dispatch?: CommandDispatchInfo;
    };
}
//# sourceMappingURL=integration-command-event.d.ts.map