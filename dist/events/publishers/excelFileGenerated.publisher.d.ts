import { Publisher, Subjects, ExcelFileGeneratedEvent } from '../../common';
export declare class ExcelFileGeneratedPublisher extends Publisher<ExcelFileGeneratedEvent> {
    subject: Subjects.ExcelFileGenerated;
    publish(data: ExcelFileGeneratedEvent['data']): Promise<void>;
}
