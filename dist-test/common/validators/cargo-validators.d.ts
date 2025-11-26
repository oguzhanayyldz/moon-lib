import { ShipmentAddress } from '../interfaces/shipment-export.interface';
/**
 * Cargo Validators
 * Kargo verileri için validation fonksiyonları
 */
/**
 * Adres validasyonu
 * @param address - Validate edilecek adres
 * @param fieldName - Alan adı (hata mesajı için)
 * @throws CargoValidationError
 */
export declare const validateAddress: (address: ShipmentAddress, fieldName?: string) => void;
/**
 * Paket bilgileri validasyonu
 * @param packageData - Validate edilecek paket bilgileri
 * @throws CargoValidationError
 */
export declare const validatePackage: (packageData: {
    weight: number;
    weightUnit: "kg" | "g";
    quantity: number;
    dimensions?: {
        length: number;
        width: number;
        height: number;
        unit: "cm" | "m";
    };
}) => void;
/**
 * Ağırlık validasyonu (standalone)
 * @param weight - Ağırlık
 * @param unit - Birim ('kg' veya 'g')
 * @throws CargoValidationError
 */
export declare const validateWeight: (weight: number, unit: "kg" | "g") => void;
/**
 * Boyutlar validasyonu (standalone)
 * @param dimensions - Boyut bilgileri
 * @throws CargoValidationError
 */
export declare const validateDimensions: (dimensions: {
    length: number;
    width: number;
    height: number;
    unit: "cm" | "m";
}) => void;
/**
 * Telefon numarası validasyonu
 * @param phone - Telefon numarası
 * @param fieldName - Alan adı (hata mesajı için)
 * @throws CargoValidationError
 */
export declare const validatePhone: (phone: string, fieldName?: string) => void;
/**
 * Desi hesaplama
 * @param dimensions - Boyut bilgileri
 * @returns Desi değeri
 */
export declare const calculateDesi: (dimensions: {
    length: number;
    width: number;
    height: number;
    unit: "cm" | "m";
}) => number;
/**
 * Shipping number format validasyonu
 * @param shippingNumber - Kargo numarası
 * @throws CargoValidationError
 */
export declare const validateShippingNumber: (shippingNumber: string) => void;
//# sourceMappingURL=cargo-validators.d.ts.map