import { Publisher, Subjects, DeleteProductImagesCompletedEvent } from '../../common';
export declare class DeleteProductImagesCompletedPublisher extends Publisher<DeleteProductImagesCompletedEvent> {
    subject: Subjects.DeleteProductImagesCompleted;
    publish(data: DeleteProductImagesCompletedEvent['data']): Promise<void>;
}
//# sourceMappingURL=deleteProductImagesCompletedPublisher.publisher.d.ts.map