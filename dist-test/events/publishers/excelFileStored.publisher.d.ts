import { Publisher, Subjects, ExcelFileStoredEvent } from '../../common';
export declare class ExcelFileStoredPublisher extends Publisher<ExcelFileStoredEvent> {
    subject: Subjects.ExcelFileStored;
    publish(data: ExcelFileStoredEvent['data']): Promise<void>;
}
//# sourceMappingURL=excelFileStored.publisher.d.ts.map