import { Publisher, Subjects, DeleteProductImagesEvent } from '../../common';
export declare class DeleteProductImagesPublisher extends Publisher<DeleteProductImagesEvent> {
    subject: Subjects.DeleteProductImages;
    publish(data: DeleteProductImagesEvent['data']): Promise<void>;
}
