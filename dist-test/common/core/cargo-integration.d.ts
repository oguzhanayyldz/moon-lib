import { BaseIntegration } from "./base-integration";
/**
 * Cargo Integration Base Class
 *
 * Kargo entegrasyonları için temel sınıf.
 *
 * @abstract
 * @extends BaseIntegration
 */
export declare abstract class CargoIntegration extends BaseIntegration {
    constructor();
    /**
     * Kargo gönderimi oluşturur
     */
    protected abstract createShipment(shipmentData: any): Promise<{
        shippingNumber: string;
        trackingNumber?: string;
        printLink?: string;
        trackingLink?: string;
    }>;
    /**
     * Kargo etiketi yazdırır/alır
     */
    protected abstract printLabel?(shippingNumber: string): Promise<{
        printLink?: string;
        printData?: string;
        format?: 'pdf' | 'zpl' | 'epl';
    }>;
    /**
     * Kargo takip bilgilerini sorgular
     */
    protected abstract trackShipment(shippingNumber: string): Promise<{
        trackingNumber?: string;
        deliveryStatus: string;
        currentLocation?: string;
        sentDate?: Date;
        shippedDate?: Date;
        deliveredDate?: Date;
        history?: Array<{
            date: Date;
            status: string;
            description: string;
            location?: string;
        }>;
    }>;
    /**
     * Kargo iptal eder
     */
    protected abstract cancelShipment?(shippingNumber: string, reason?: string): Promise<{
        success: boolean;
        cancelled: boolean;
        message?: string;
    }>;
    /**
     * Toplu kargo takip sorgulama
     */
    protected abstract fetchTrackingUpdatesBulk?(params: {
        cargoIntegrationId: string;
        shipments: Array<{
            orderCargoId: string;
            shippingNumber: string;
            trackingNumber?: string;
        }>;
    }): Promise<Array<{
        orderCargoId: string;
        shippingNumber: string;
        success: boolean;
        trackingNumber?: string;
        deliveryStatus?: string;
        sentDate?: Date;
        shippedDate?: Date;
        deliveredDate?: Date;
        currentLocation?: string;
        error?: string;
    }>>;
    /**
     * Adres doğrulama
     */
    protected validateAddress(_address: {
        country: string;
        city: string;
        district: string;
        addressLine1: string;
        postalCode?: string;
    }): Promise<{
        valid: boolean;
        suggestions?: any[];
        message?: string;
    }>;
    /**
     * Kargo maliyeti hesaplama
     */
    protected calculateShippingCost(_params: {
        senderCity: string;
        recipientCity: string;
        weight: number;
        desi?: number;
        deliveryType?: 'standard' | 'express' | 'economy';
    }): Promise<{
        cost: number;
        currency: string;
        deliveryTime?: string;
    }>;
    /**
     * Şube/dağıtım merkezi sorgulama
     */
    protected getBranches(_city: string, _district?: string): Promise<Array<{
        branchCode: string;
        branchName: string;
        address: string;
        phone?: string;
        workingHours?: string;
    }>>;
}
//# sourceMappingURL=cargo-integration.d.ts.map