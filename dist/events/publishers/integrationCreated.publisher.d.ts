import { Publisher, Subjects, IntegrationCreatedEvent } from '../../common';
export declare class IntegrationCreatedPublisher extends Publisher<IntegrationCreatedEvent> {
    subject: Subjects.IntegrationCreated;
    publish(data: IntegrationCreatedEvent['data']): Promise<void>;
}
