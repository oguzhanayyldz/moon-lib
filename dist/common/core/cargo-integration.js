"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
    validateAddress(address) {
        return __awaiter(this, void 0, void 0, function* () {
            // Default implementation - address validation not supported
            return {
                valid: true,
                message: 'Address validation not supported by this cargo provider'
            };
        });
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
    calculateShippingCost(params) {
        return __awaiter(this, void 0, void 0, function* () {
            // Default implementation - cost calculation not supported
            throw new Error('Shipping cost calculation not supported by this cargo provider');
        });
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
    getBranches(city, district) {
        return __awaiter(this, void 0, void 0, function* () {
            // Default implementation - branch listing not supported
            return [];
        });
    }
}
exports.CargoIntegration = CargoIntegration;
