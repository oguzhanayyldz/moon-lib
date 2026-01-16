import { Subjects } from "./subjects";
export interface SupportedAction {
    action: 'SYNC_ORDERS' | 'SYNC_PRODUCTS' | 'FETCH_IMAGES' | 'SYNC_BRANDS' | 'SYNC_CATEGORIES' | 'SYNC_ATTRIBUTES' | 'SYNC_ORDER_STATUSES' | 'MATCH_PRODUCTS' | 'FETCH_STOCKS' | 'FETCH_PRICES' | 'UPDATE_STOCK' | 'UPDATE_PRICE' | 'CREATE_INVOICE' | 'SEND_PRODUCTS' | 'FORMALIZE_ORDERS' | 'FETCH_PDF_LINKS' | 'FETCH_TRACKING_BULK' | 'CREATE_SHIPMENT_BULK' | 'FETCH_LOCATIONS';
    enabled: boolean;
    parameters?: any[];
}
export interface UserIntegrationSettingsEvent {
    subject: Subjects.UserIntegrationSettings;
    data: {
        list: UserIntegrationSettingsData[];
    };
}
export interface UserIntegrationSettingsData {
    id: string;
    uuid: string;
    user: string;
    version: number;
    integration: string;
    credentials: {
        [key: string]: string;
    };
    active: boolean;
    lastSync?: Date;
    supportedActions?: SupportedAction[];
    uniqueCode?: string | null;
    creationDate?: Date;
    updatedOn?: Date;
    deleted?: boolean;
    deletionDate?: Date | null;
}
//# sourceMappingURL=user-integration-settings-event.d.ts.map