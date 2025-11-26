/**
 * Platformlar arası ortak kargo gönderimi veri modeli
 * Bu model, farklı kargo entegrasyon platformlarına aktarılacak kargo verilerini standartlaştırır.
 *
 * CommonProductExport pattern'ini takip eder.
 */
/**
 * Kargo adresi modeli
 */
export interface ShipmentAddress {
    country: string;
    city: string;
    district: string;
    neighborhood?: string;
    addressLine1: string;
    addressLine2?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
}
/**
 * Kargo gönderimi için ortak veri modeli
 */
export interface CommonShipmentExport {
    id: string;
    externalId?: string;
    orderId: string;
    sender: {
        name: string;
        phone: string;
        email?: string;
        address: ShipmentAddress;
        taxNumber?: string;
        taxOffice?: string;
    };
    recipient: {
        name: string;
        phone: string;
        email?: string;
        address: ShipmentAddress;
        identityNumber?: string;
        taxNumber?: string;
    };
    package: {
        weight: number;
        weightUnit: 'kg' | 'g';
        dimensions?: {
            length: number;
            width: number;
            height: number;
            unit: 'cm' | 'm';
        };
        desi?: number;
        quantity: number;
        description?: string;
        content?: string;
    };
    payment: {
        type: 'sender' | 'recipient';
        amount?: number;
        currency?: string;
    };
    delivery?: {
        type?: 'standard' | 'express' | 'economy';
        preferredDate?: Date;
        preferredTimeSlot?: string;
        instructions?: string;
        requireSignature?: boolean;
    };
    insurance?: {
        required: boolean;
        amount?: number;
        currency?: string;
    };
    order?: {
        orderNumber?: string;
        platform?: string;
        platformOrderId?: string;
        totalAmount?: number;
        currency?: string;
    };
    autoPrintLabel?: boolean;
    metadata?: Record<string, any>;
}
/**
 * Kargo gönderimi oluşturma isteği modeli
 */
export interface ShipmentExportRequest {
    shipmentId: string;
    platform: string;
    operation: 'create' | 'cancel';
    platformParams?: Record<string, any>;
}
/**
 * Kargo gönderimi oluşturma sonucu modeli
 */
export interface ShipmentExportResult {
    success: boolean;
    shippingNumber?: string;
    trackingNumber?: string;
    printLink?: string;
    trackingLink?: string;
    estimatedDeliveryDate?: Date;
    error?: string;
    platformResponse?: Record<string, any>;
}
/**
 * Kargo etiket yazdırma isteği modeli
 */
export interface ShipmentLabelRequest {
    shippingNumber: string;
    orderCargoId?: string;
    format?: 'pdf' | 'zpl' | 'epl';
}
/**
 * Kargo etiket yazdırma sonucu modeli
 */
export interface ShipmentLabelResult {
    success: boolean;
    printLink?: string;
    printData?: string;
    format?: 'pdf' | 'zpl' | 'epl';
    error?: string;
}
/**
 * Kargo takip sorgulama isteği modeli
 */
export interface ShipmentTrackingRequest {
    shippingNumber: string;
    trackingNumber?: string;
}
/**
 * Kargo takip sorgulama sonucu modeli
 */
export interface ShipmentTrackingResult {
    success: boolean;
    shippingNumber: string;
    trackingNumber?: string;
    deliveryStatus?: string;
    normalizedStatus?: 'pending' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed_delivery' | 'returned' | 'cancelled';
    currentLocation?: string;
    lastCheckpoint?: string;
    sentDate?: Date;
    shippedDate?: Date;
    deliveredDate?: Date;
    history?: Array<{
        date: Date;
        status: string;
        description: string;
        location?: string;
    }>;
    error?: string;
    platformResponse?: Record<string, any>;
}
/**
 * Kargo iptal isteği modeli
 */
export interface ShipmentCancelRequest {
    shippingNumber: string;
    reason?: string;
}
/**
 * Kargo iptal sonucu modeli
 */
export interface ShipmentCancelResult {
    success: boolean;
    shippingNumber: string;
    cancelled: boolean;
    cancelledAt?: Date;
    message?: string;
    error?: string;
}
/**
 * Toplu kargo takip güncellemesi için batch item
 */
export interface ShipmentTrackingBatchItem {
    orderCargoId: string;
    shippingNumber: string;
    trackingNumber?: string;
}
/**
 * Toplu kargo takip güncellemesi sonucu
 */
export interface ShipmentTrackingBatchResult {
    orderCargoId: string;
    shippingNumber: string;
    success: boolean;
    trackingNumber?: string;
    deliveryStatus?: string;
    normalizedStatus?: string;
    sentDate?: Date;
    shippedDate?: Date;
    deliveredDate?: Date;
    currentLocation?: string;
    error?: string;
    errorDetails?: any;
}
//# sourceMappingURL=shipment-export.interface.d.ts.map