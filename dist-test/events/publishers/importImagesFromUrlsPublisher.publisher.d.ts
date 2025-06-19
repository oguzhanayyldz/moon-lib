import { Publisher, Subjects, ImportImagesFromUrlsEvent } from '../../common';
export declare class ImportImagesFromUrlsPublisher extends Publisher<ImportImagesFromUrlsEvent> {
    subject: Subjects.ImportImagesFromUrls;
    publish(data: ImportImagesFromUrlsEvent['data']): Promise<void>;
}
//# sourceMappingURL=importImagesFromUrlsPublisher.publisher.d.ts.map