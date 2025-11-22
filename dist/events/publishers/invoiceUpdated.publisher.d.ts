import { Publisher, Subjects, InvoiceUpdatedEvent } from '../../common';
export declare class InvoiceUpdatedPublisher extends Publisher<InvoiceUpdatedEvent> {
    subject: Subjects.InvoiceUpdated;
    publish(data: InvoiceUpdatedEvent['data']): Promise<void>;
}
