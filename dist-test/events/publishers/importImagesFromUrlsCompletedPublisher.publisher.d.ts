import { Publisher, Subjects, ImportImagesFromUrlsCompletedEvent } from '../../common';
export declare class ImportImagesFromUrlsCompletedPublisher extends Publisher<ImportImagesFromUrlsCompletedEvent> {
    subject: Subjects.ImportImagesFromUrlsCompleted;
    publish(data: ImportImagesFromUrlsCompletedEvent['data']): Promise<void>;
}
//# sourceMappingURL=importImagesFromUrlsCompletedPublisher.publisher.d.ts.map