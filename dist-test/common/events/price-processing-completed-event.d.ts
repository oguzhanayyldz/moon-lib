import { Subjects } from "./subjects";
export interface PriceProcessingCompletedEvent {
    subject: Subjects.PriceProcessingCompleted;
    data: {
        processId: string;
        userId: string;
        success: boolean;
        processedCount: number;
        timestamp: Date;
    };
}
//# sourceMappingURL=price-processing-completed-event.d.ts.map