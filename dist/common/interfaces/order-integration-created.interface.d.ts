import { OrderStatus } from "../events/types/order-status";
import { OrderType } from "../events/types/order-type";
import { PaymentType } from "../events/types/payment-type";
import { CurrencyCode } from "../types/currency-code";
import { ResourceName } from "../types/resourceName";
export interface OrderIntegrationCreated {
    customer: OrderIntegrationCustomer;
    payment?: OrderIntegrationPayment;
    cargoInfo?: OrderIntegrationCargoInfo;
    billingAddress: OrderIntegrationAddress;
    shippingAddress: OrderIntegrationAddress;
    purchaseNumber: string;
    platformNumber: string;
    platform: ResourceName;
    docSerial?: string;
    type?: OrderType;
    status?: OrderStatus;
    total: number;
    totalWithOutTax?: number;
    taxTotal?: number;
    costTotal?: number;
    commissionTotal?: number;
    discountTotal?: number;
    invoiceTotal?: number;
    creditTotal?: number;
    shippingTotal?: number;
    shippingTaxRate?: number;
    date: Date;
    currency: CurrencyCode;
    orderProducts: OrderIntegrationProductCreted[];
    fields?: Record<string, any>;
}
export interface OrderIntegrationProductCreted {
    quantity: number;
    name: string;
    sku: string;
    barcode: string;
    code?: string;
    image?: string;
    price: number;
    priceWithoutTax?: number;
    taxPrice: number;
    tax: number;
    priceTotal?: number;
    taxTotal?: number;
    discount?: number;
    discountTotal?: number;
    commissionPrice?: number;
    commissionTotal?: number;
    costPrice?: number;
    costTotal?: number;
    fields?: Record<string, any>;
}
export interface OrderIntegrationCustomer {
    name: string;
    surname: string;
    email: string;
    code?: string;
    gender?: string;
    disctrict?: string;
    country?: string;
    postalCode?: string;
    identityNumber?: string;
    taxNumber?: string;
    taxOffice?: string;
    fields?: Record<string, any>;
}
export interface OrderIntegrationPayment {
    bankName?: string;
    bankCode?: string;
    paymentCode?: string;
    paymentType?: PaymentType;
    date?: Date;
    fields?: Record<string, any>;
}
export interface OrderIntegrationCargoInfo {
    name: string;
    shippingNumber?: string;
    trackingNumber?: string;
    printLink?: string;
    trackingLink?: string;
    senderNumber?: string;
    sentDate?: Date;
    shippedDate?: Date;
    deliveredDate?: Date;
    /** Etiket kaynağı: 'platform' (entegrasyon API) veya 'panel' (kullanıcı paneli) */
    labelSource?: 'platform' | 'panel';
    fields?: Record<string, any>;
}
export interface OrderIntegrationAddress {
    name: string;
    surname: string;
    country: string;
    city: string;
    district?: string;
    addressLine1: string;
    addressLine2?: string;
    postalCode?: string;
    phone?: string;
    email?: string;
    identityNumber?: string;
    taxNumber?: string;
    taxOffice?: string;
    companyName?: string;
    fields?: Record<string, any>;
}
export declare enum OrderUpdateFrequency {
    MINUTE = "minute",
    HOURLY = "hourly",
    DAILY = "daily",
    WEEKLY = "weekly",
    MANUAL = "manual"
}
export interface OrderAdvancedSettings {
    fetchOnlyNew: boolean;
    fetchDateRange: number;
    notifyOnErrors: boolean;
    keepHistory: boolean;
}
export interface OrderSyncAdvancedSettings {
    syncStatus: boolean;
    syncCancelled: boolean;
    syncReturned: boolean;
}
export interface OrderSources {
    updateFrequency: OrderUpdateFrequency;
    updateTime: string | number;
    integrationId: string;
    name: string;
    enabled: boolean;
    advanced: OrderAdvancedSettings;
    autoSync: boolean;
    syncAdvanced: OrderSyncAdvancedSettings;
}
export interface OrderUpdateSettings {
    enabled: boolean;
    sources: OrderSources[];
    lastUpdate: string | null;
}
