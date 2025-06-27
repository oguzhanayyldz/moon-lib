import { OrderStatus } from "../events/types/order-status";
import { ReturnStatus } from "../events/types/return-status";
import { ResourceName } from "../types/resourceName";

export interface OrderIntegrationStatusUpdated {
    purchaseNumber: string;
    platformNumber?: string;
    status?: OrderStatus;
    costTotal?: number;
    commissionTotal?: number;
    invoiceTotal?: number;
    creditTotal?: number;
    shippingTotal?: number;
    shippingTaxRate?: number;
    orderCargo?: OrderIntegrationOrderCargoStatusUpdated;
    orderProducts?: OrderIntegrationProductStatusUpdated[];
    fields?: Record<string, any>;
}

export interface OrderIntegrationProductStatusUpdated {
    sku: string;
    barcode: string;
    code?: string;
    cancelled?: boolean;
    cancelledQuantity?: number;
    cancelledDate?: Date;
    returned?: boolean;
    returnId?: string;
    returnItemId?: string;
    returnedQuantity?: number;
    returnedDate?: Date;
    returnStatus?: ReturnStatus;
    returnTrackingNumber?: string;
    returnReason?: string;
    returnNotes?: string;
    fields?: Record<string, any>;
}

export interface OrderIntegrationOrderCargoStatusUpdated {
    cargoName: string;
    shippingNumber?: string;
    trackingNumber?: string;
    printLink?: string;
    trackingLink?: string;
    senderNumber?: string;
    sentDate?: Date;
    shippedDate?: Date;
    deliveredDate?: Date;
    fields?: Record<string, any>;
}