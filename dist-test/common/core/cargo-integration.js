"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CargoIntegration = void 0;
const integration_type_1 = require("../types/integration-type");
const base_integration_1 = require("./base-integration");
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
class CargoIntegration extends base_integration_1.BaseIntegration {
    constructor() {
        super();
        this.type = integration_type_1.IntegrationType.Cargo;
    }
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
    async validateAddress(address) {
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
    async calculateShippingCost(params) {
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
    async getBranches(city, district) {
        // Default implementation - branch listing not supported
        return [];
    }
}
exports.CargoIntegration = CargoIntegration;
//# sourceMappingURL=cargo-integration.js.map