import { Subjects } from "./subjects";
export interface ImportImagesFromUrlsEvent {
    subject: Subjects.ImportImagesFromUrls;
    data: {
        requestId: string;
        userId: string;
        urls: string[];
        productId?: string;
        productIdMap?: Record<string, string>;
        options?: {
            width?: number;
            height?: number;
            quality?: number;
            format?: 'jpeg' | 'png' | 'webp';
            originalFilenames?: boolean;
        };
        timestamp?: string;
    };
}
//# sourceMappingURL=import-images-from-urls-event.d.ts.map