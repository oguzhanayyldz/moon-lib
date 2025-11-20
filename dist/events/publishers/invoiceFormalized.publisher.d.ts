import { Publisher, Subjects, InvoiceFormalizedEvent } from '../../common';
export declare class InvoiceFormalizedPublisher extends Publisher<InvoiceFormalizedEvent> {
    subject: Subjects.InvoiceFormalized;
    publish(data: InvoiceFormalizedEvent['data']): Promise<void>;
}
