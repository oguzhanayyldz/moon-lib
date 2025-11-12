import { NotificationCreatedEvent, Publisher, Subjects } from '../../common';
export declare class NotificationCreatedPublisher extends Publisher<NotificationCreatedEvent> {
    subject: Subjects.NotificationCreated;
    publish(data: NotificationCreatedEvent['data']): Promise<void>;
}
