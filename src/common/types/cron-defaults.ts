export type ScheduleFrequency = 'minute' | 'hourly' | 'daily' | 'weekly';

export interface CronDefaultItem {
    enabled: boolean;
    frequency: ScheduleFrequency;
    value: string;
    minInterval: number;
}

export interface CronDefaults {
    productSync: CronDefaultItem;
    stockSync: CronDefaultItem;
    priceSync: CronDefaultItem;
    orderSync: CronDefaultItem;
    shipmentAutomation: CronDefaultItem;
    invoiceAutomation: CronDefaultItem;
}
