import { Publisher, Subjects, InvoiceCreatedEvent } from '../../common';
export declare class InvoiceCreatedPublisher extends Publisher<InvoiceCreatedEvent> {
    subject: Subjects.InvoiceCreated;
    publish(data: InvoiceCreatedEvent['data']): Promise<void>;
}
