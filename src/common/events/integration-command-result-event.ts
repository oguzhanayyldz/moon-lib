import { ResourceName } from "../types/resourceName";
import { Subjects } from "./subjects";

export interface IntegrationCommandResultEvent {
    subject: Subjects.IntegrationCommandResult;
    data: {
        requestId: string;
        user: string;
        platform: ResourceName;
        command: string;
        success: boolean;
        error?: string | null,
        /** Toplu komutlarda (updatePrices/updateStocks) `result.summary: ItemSummary` taşır; success anlamı "komut koştu" */
        result?: any,
        timestamp: string;
    };
}