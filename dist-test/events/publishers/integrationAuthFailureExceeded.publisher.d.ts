import { Publisher, Subjects, IntegrationAuthFailureExceededEvent } from '../../common';
export declare class IntegrationAuthFailureExceededPublisher extends Publisher<IntegrationAuthFailureExceededEvent> {
    subject: Subjects.IntegrationAuthFailureExceeded;
    publish(data: IntegrationAuthFailureExceededEvent['data']): Promise<void>;
}
//# sourceMappingURL=integrationAuthFailureExceeded.publisher.d.ts.map