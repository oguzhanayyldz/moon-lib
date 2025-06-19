import { IntegrationCommandEvent, Publisher, Subjects } from '../../common';
export declare class IntegrationCommandPublisher extends Publisher<IntegrationCommandEvent> {
    subject: Subjects.IntegrationCommand;
    publish(data: IntegrationCommandEvent['data']): Promise<void>;
}
