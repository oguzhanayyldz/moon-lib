import { Publisher, Subjects, IntegrationUpdatedEvent } from '../../common';
export declare class IntegrationUpdatedPublisher extends Publisher<IntegrationUpdatedEvent> {
    subject: Subjects.IntegrationUpdated;
    publish(data: IntegrationUpdatedEvent['data']): Promise<void>;
}
