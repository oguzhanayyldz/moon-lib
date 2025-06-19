import { Subjects } from "./subjects";
export interface DeleteProductImagesEvent {
    subject: Subjects.DeleteProductImages;
    data: {
        requestId: string;
        userId: string;
        productId: string;
    };
}
//# sourceMappingURL=delete-product-images-event.d.ts.map