import { Publisher, Subjects, CustomerUpdatedEvent } from '../../common';
export declare class CustomerUpdatedPublisher extends Publisher<CustomerUpdatedEvent> {
    subject: Subjects.CustomerUpdated;
    publish(data: CustomerUpdatedEvent['data']): Promise<void>;
}
//# sourceMappingURL=customerUpdated.publisher.d.ts.map