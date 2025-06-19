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
