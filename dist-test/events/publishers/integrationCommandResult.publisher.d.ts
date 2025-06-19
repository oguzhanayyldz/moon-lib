import { IntegrationCommandResultEvent, Publisher, Subjects } from '../../common';
export declare class IntegrationCommandResultPublisher extends Publisher<IntegrationCommandResultEvent> {
    subject: Subjects.IntegrationCommandResult;
    publish(data: IntegrationCommandResultEvent['data']): Promise<void>;
}
//# sourceMappingURL=integrationCommandResult.publisher.d.ts.map