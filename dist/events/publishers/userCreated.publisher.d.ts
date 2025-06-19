import { Publisher, Subjects, UserCreatedEvent } from '../../common';
export declare class UserCreatedPublisher extends Publisher<UserCreatedEvent> {
    subject: Subjects.UserCreated;
    publish(data: UserCreatedEvent['data']): Promise<void>;
}
