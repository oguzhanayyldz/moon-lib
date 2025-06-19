import { Subjects } from "./subjects";
import { ResourceName } from "../types/resourceName";
import { ProductImageIntegrationUpdated } from "../interfaces/product-image-integration-updated.interface";
export interface ProductImageIntegrationUpdatedEvent {
    subject: Subjects.ProductImageIntegrationUpdated;
    data: {
        requestId: string;
        userId: string;
        data: ProductImageIntegrationUpdated[];
        source?: ResourceName;
        timestamp?: Date;
    };
}
//# sourceMappingURL=product-image-integration-updated-event.d.ts.map