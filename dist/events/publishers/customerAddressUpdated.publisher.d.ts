import { Publisher, Subjects, CustomerAddressUpdatedEvent } from '../../common';
export declare class CustomerAddressUpdatedPublisher extends Publisher<CustomerAddressUpdatedEvent> {
    subject: Subjects.CustomerAddressUpdated;
    publish(data: CustomerAddressUpdatedEvent['data']): Promise<void>;
}
