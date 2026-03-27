import { Subjects } from "./subjects";

export interface ImportImagesFromUrlsEvent {
    subject: Subjects.ImportImagesFromUrls;
    data: {
        requestId: string;
        userId: string;
        urls: string[];
        productId?: string;
        productIdMap?: Record<string, string>;
        combinationIdMap?: Record<string, string>; // URL -> CombinationId eşleştirmesi
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