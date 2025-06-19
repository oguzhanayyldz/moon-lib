import { Publisher, Subjects, UserUpdatedEvent } from '../../common';
export declare class UserUpdatedPublisher extends Publisher<UserUpdatedEvent> {
    subject: Subjects.UserUpdated;
    publish(data: UserUpdatedEvent['data']): Promise<void>;
}
