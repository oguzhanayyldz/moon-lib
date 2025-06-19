import { Subjects } from "./subjects";
export interface DeleteProductImagesCompletedEvent {
    subject: Subjects.DeleteProductImagesCompleted;
    data: {
        requestId: string;
        userId: string;
        productId: string;
        totalImages: number;
        successful: number;
        failed: number;
    };
}
//# sourceMappingURL=delete-product-images-completed-event.d.ts.map