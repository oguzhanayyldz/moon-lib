import { Publisher, Subjects, UserConfigUpdatedEvent } from '../../common';
export declare class UserConfigUpdatedPublisher extends Publisher<UserConfigUpdatedEvent> {
    subject: Subjects.UserConfigUpdated;
    publish(data: UserConfigUpdatedEvent['data']): Promise<void>;
}
