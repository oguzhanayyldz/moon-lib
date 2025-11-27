import { IntegrationType } from "../types/integration-type";
import { BaseIntegration } from "./base-integration";

/**
 * Cargo Integration Base Class
 *
 * Kargo entegrasyonları için temel sınıf.
 * Marketplace ve E-commerce entegrasyonlarından farklı olarak:
 * - Sipariş verilerinden kargo gönderimi oluşturur
 * - Kargo etiketlerini yazdırır
 * - Kargo takip bilgilerini sorgular
 * - Kargo iptal işlemlerini yönetir
 *
 * Örnek Cargo Integration'lar:
 * - Aras Kargo
 * - MNG Kargo
 * - Yurtiçi Kargo
 * - PTT Kargo
 * - UPS, DHL, FedEx (uluslararası)
 *
 * @abstract
 * @extends BaseIntegration
 */
export abstract class CargoIntegration extends BaseIntegration {
    constructor() {
        super();
        this.type = IntegrationType.Cargo;
    }

    /**
     * Kargo gönderimi oluşturur
     *
     * Sipariş bilgilerinden kargo oluşturur ve kargo şirketinin API'sine gönderir.
     * Başarılı olursa shippingNumber, trackingNumber ve printLink döner.
     *
     * @param shipmentData - Kargo verileri (CommonShipmentExport formatında)
     * @returns Kargo numarası, takip numarası, etiket linki
     * @abstract
     */
    protected abstract createShipment(shipmentData: any): Promise<{
        shippingNumber: string;
        trackingNumber?: string;
        printLink?: string;
        trackingLink?: string;
    }>;

    /**
     * Kargo etiketi yazdırır/alır
     *
     * Oluşturulmuş bir kargonun etiketini PDF veya başka formatlarda alır.
     * Bazı kargo firmalarında createShipment ile birlikte dönebilir,
     * bazılarında ayrı bir API call gerekebilir.
     *
     * @param shippingNumber - Kargo numarası
     * @returns Etiket PDF linki veya base64 data
     * @abstract
     * @optional - Bazı firmalar createShipment'ta label döner
     */
    protected abstract printLabel?(shippingNumber: string): Promise<{
        printLink?: string;
        printData?: string;
        format?: 'pdf' | 'zpl' | 'epl';
    }>;

    /**
     * Kargo takip bilgilerini sorgular
     *
     * Kargonun güncel durumunu, lokasyonunu ve geçmiş hareketlerini sorgular.
     *
     * @param shippingNumber - Kargo numarası
     * @returns Kargo durumu, lokasyon, tarihler
     * @abstract
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
     *
     * Henüz teslim edilmemiş bir kargoyu iptal eder.
     * NOT: Teslim edilen veya çok ilerlemiş kargolar iptal edilemeyebilir!
     *
     * @param shippingNumber - Kargo numarası
     * @param reason - İptal nedeni (opsiyonel)
     * @returns İptal durumu
     * @abstract
     * @optional - Bazı firmalar iptal desteklemeyebilir
     */
    protected abstract cancelShipment?(shippingNumber: string, reason?: string): Promise<{
        success: boolean;
        cancelled: boolean;
        message?: string;
    }>;

    /**
     * Toplu kargo takip sorgulama (batch operation)
     *
     * Birden fazla kargonun durumunu tek seferde sorgular.
     * Bazı kargo firmaları batch API sağlar, performans açısından önemli.
     *
     * @param shipments - Takip edilecek kargolar (shippingNumber array)
     * @returns Batch tracking sonuçları
     * @abstract
     * @optional - Bazı firmalar batch API sağlamaz
     */
    protected abstract fetchTrackingUpdatesBulk?(shipments: Array<{
        orderCargoId: string;
        shippingNumber: string;
        trackingNumber?: string;
    }>): Promise<Array<{
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
     * Adres doğrulama (opsiyonel)
     *
     * Bazı kargo firmaları kargo oluşturmadan önce adres doğrulama API'si sağlar.
     * Bu sayede geçersiz adresler erken tespit edilebilir.
     *
     * @param address - Doğrulanacak adres
     * @returns Adres geçerli mi, önerilen düzeltmeler
     * @optional - Override if cargo provider supports address validation
     */
    protected async validateAddress(address: {
        country: string;
        city: string;
        district: string;
        addressLine1: string;
        postalCode?: string;
    }): Promise<{
        valid: boolean;
        suggestions?: any[];
        message?: string;
    }> {
        // Default implementation - address validation not supported
        return {
            valid: true,
            message: 'Address validation not supported by this cargo provider'
        };
    }

    /**
     * Kargo maliyeti hesaplama (opsiyonel)
     *
     * Bazı kargo firmaları kargo oluşturmadan önce maliyet hesaplama API'si sağlar.
     * Gönderici/alıcı adresine ve paket bilgilerine göre tahmini maliyet döner.
     *
     * @param params - Maliyet hesaplama parametreleri
     * @returns Tahmini kargo maliyeti
     * @optional - Override if cargo provider supports cost calculation
     */
    protected async calculateShippingCost(params: {
        senderCity: string;
        recipientCity: string;
        weight: number;
        desi?: number;
        deliveryType?: 'standard' | 'express' | 'economy';
    }): Promise<{
        cost: number;
        currency: string;
        deliveryTime?: string;
    }> {
        // Default implementation - cost calculation not supported
        throw new Error('Shipping cost calculation not supported by this cargo provider');
    }

    /**
     * Şube/dağıtım merkezi sorgulama (opsiyonel)
     *
     * Belirli bir bölgedeki kargo şubelerini veya dağıtım merkezlerini listeler.
     * Müşteri kargosunu şubeden teslim alacaksa kullanılır.
     *
     * @param city - Şehir
     * @param district - İlçe (opsiyonel)
     * @returns Şube listesi
     * @optional - Override if cargo provider supports branch listing
     */
    protected async getBranches(city: string, district?: string): Promise<Array<{
        branchCode: string;
        branchName: string;
        address: string;
        phone?: string;
        workingHours?: string;
    }>> {
        // Default implementation - branch listing not supported
        return [];
    }
}
