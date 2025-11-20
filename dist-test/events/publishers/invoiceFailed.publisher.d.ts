import { Publisher, Subjects, InvoiceFailedEvent } from '../../common';
export declare class InvoiceFailedPublisher extends Publisher<InvoiceFailedEvent> {
    subject: Subjects.InvoiceFailed;
    publish(data: InvoiceFailedEvent['data']): Promise<void>;
}
//# sourceMappingURL=invoiceFailed.publisher.d.ts.map