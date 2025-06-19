import { Publisher, Subjects, UserIntegrationSettingsEvent } from '../../common';
export declare class UserIntegrationSettingsPublisher extends Publisher<UserIntegrationSettingsEvent> {
    subject: Subjects.UserIntegrationSettings;
    publish(data: UserIntegrationSettingsEvent['data']): Promise<void>;
}
//# sourceMappingURL=userIntegrationSettings.publisher.d.ts.map