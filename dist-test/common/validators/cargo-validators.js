"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateShippingNumber = exports.calculateDesi = exports.validatePhone = exports.validateDimensions = exports.validateWeight = exports.validatePackage = exports.validateAddress = void 0;
const cargo_errors_1 = require("../errors/cargo-errors");
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
const validateAddress = (address, fieldName = 'address') => {
    const errors = [];
    if (!address) {
        errors.push({ field: fieldName, message: 'Address is required' });
        throw new cargo_errors_1.CargoValidationError(errors);
    }
    if (!address.country || address.country.trim() === '') {
        errors.push({ field: `${fieldName}.country`, message: 'Country is required' });
    }
    if (!address.city || address.city.trim() === '') {
        errors.push({ field: `${fieldName}.city`, message: 'City is required' });
    }
    if (!address.district || address.district.trim() === '') {
        errors.push({ field: `${fieldName}.district`, message: 'District is required' });
    }
    if (!address.addressLine1 || address.addressLine1.trim() === '') {
        errors.push({ field: `${fieldName}.addressLine1`, message: 'Address line 1 is required' });
    }
    // Address line 1 minimum uzunluk kontrolü
    if (address.addressLine1 && address.addressLine1.length < 10) {
        errors.push({ field: `${fieldName}.addressLine1`, message: 'Address line 1 must be at least 10 characters' });
    }
    if (errors.length > 0) {
        throw new cargo_errors_1.CargoValidationError(errors);
    }
};
exports.validateAddress = validateAddress;
/**
 * Paket bilgileri validasyonu
 * @param packageData - Validate edilecek paket bilgileri
 * @throws CargoValidationError
 */
const validatePackage = (packageData) => {
    const errors = [];
    if (!packageData) {
        errors.push({ field: 'package', message: 'Package information is required' });
        throw new cargo_errors_1.CargoValidationError(errors);
    }
    // Weight validation
    if (!packageData.weight || packageData.weight <= 0) {
        errors.push({ field: 'package.weight', message: 'Weight must be greater than 0' });
    }
    if (packageData.weight && packageData.weight > 100000) {
        errors.push({ field: 'package.weight', message: 'Weight exceeds maximum limit (100000 kg)' });
    }
    if (!packageData.weightUnit) {
        errors.push({ field: 'package.weightUnit', message: 'Weight unit is required (kg or g)' });
    }
    if (packageData.weightUnit && !['kg', 'g'].includes(packageData.weightUnit)) {
        errors.push({ field: 'package.weightUnit', message: 'Weight unit must be kg or g' });
    }
    // Quantity validation
    if (!packageData.quantity || packageData.quantity <= 0) {
        errors.push({ field: 'package.quantity', message: 'Quantity must be at least 1' });
    }
    if (packageData.quantity && packageData.quantity > 1000) {
        errors.push({ field: 'package.quantity', message: 'Quantity exceeds maximum limit (1000)' });
    }
    // Dimensions validation (opsiyonel ama varsa kontrol et)
    if (packageData.dimensions) {
        if (packageData.dimensions.length <= 0) {
            errors.push({ field: 'package.dimensions.length', message: 'Length must be greater than 0' });
        }
        if (packageData.dimensions.width <= 0) {
            errors.push({ field: 'package.dimensions.width', message: 'Width must be greater than 0' });
        }
        if (packageData.dimensions.height <= 0) {
            errors.push({ field: 'package.dimensions.height', message: 'Height must be greater than 0' });
        }
        if (!packageData.dimensions.unit || !['cm', 'm'].includes(packageData.dimensions.unit)) {
            errors.push({ field: 'package.dimensions.unit', message: 'Dimension unit must be cm or m' });
        }
    }
    if (errors.length > 0) {
        throw new cargo_errors_1.CargoValidationError(errors);
    }
};
exports.validatePackage = validatePackage;
/**
 * Ağırlık validasyonu (standalone)
 * @param weight - Ağırlık
 * @param unit - Birim ('kg' veya 'g')
 * @throws CargoValidationError
 */
const validateWeight = (weight, unit) => {
    const errors = [];
    if (!weight || weight <= 0) {
        errors.push({ field: 'weight', message: 'Weight must be greater than 0' });
    }
    if (!unit || !['kg', 'g'].includes(unit)) {
        errors.push({ field: 'weightUnit', message: 'Weight unit must be kg or g' });
    }
    // kg cinsinden normalize et ve max limit kontrol
    let weightInKg = weight;
    if (unit === 'g') {
        weightInKg = weight / 1000;
    }
    if (weightInKg > 100000) {
        errors.push({ field: 'weight', message: 'Weight exceeds maximum limit (100000 kg)' });
    }
    if (errors.length > 0) {
        throw new cargo_errors_1.CargoValidationError(errors);
    }
};
exports.validateWeight = validateWeight;
/**
 * Boyutlar validasyonu (standalone)
 * @param dimensions - Boyut bilgileri
 * @throws CargoValidationError
 */
const validateDimensions = (dimensions) => {
    const errors = [];
    if (!dimensions) {
        errors.push({ field: 'dimensions', message: 'Dimensions are required' });
        throw new cargo_errors_1.CargoValidationError(errors);
    }
    if (dimensions.length <= 0) {
        errors.push({ field: 'dimensions.length', message: 'Length must be greater than 0' });
    }
    if (dimensions.width <= 0) {
        errors.push({ field: 'dimensions.width', message: 'Width must be greater than 0' });
    }
    if (dimensions.height <= 0) {
        errors.push({ field: 'dimensions.height', message: 'Height must be greater than 0' });
    }
    if (!dimensions.unit || !['cm', 'm'].includes(dimensions.unit)) {
        errors.push({ field: 'dimensions.unit', message: 'Dimension unit must be cm or m' });
    }
    // cm cinsinden normalize et ve max limit kontrol
    let lengthInCm = dimensions.length;
    let widthInCm = dimensions.width;
    let heightInCm = dimensions.height;
    if (dimensions.unit === 'm') {
        lengthInCm = dimensions.length * 100;
        widthInCm = dimensions.width * 100;
        heightInCm = dimensions.height * 100;
    }
    // Maximum boyut limitleri (örnek: 500cm = 5m)
    if (lengthInCm > 500) {
        errors.push({ field: 'dimensions.length', message: 'Length exceeds maximum limit (500 cm)' });
    }
    if (widthInCm > 500) {
        errors.push({ field: 'dimensions.width', message: 'Width exceeds maximum limit (500 cm)' });
    }
    if (heightInCm > 500) {
        errors.push({ field: 'dimensions.height', message: 'Height exceeds maximum limit (500 cm)' });
    }
    if (errors.length > 0) {
        throw new cargo_errors_1.CargoValidationError(errors);
    }
};
exports.validateDimensions = validateDimensions;
/**
 * Telefon numarası validasyonu
 * @param phone - Telefon numarası
 * @param fieldName - Alan adı (hata mesajı için)
 * @throws CargoValidationError
 */
const validatePhone = (phone, fieldName = 'phone') => {
    const errors = [];
    if (!phone || phone.trim() === '') {
        errors.push({ field: fieldName, message: 'Phone number is required' });
        throw new cargo_errors_1.CargoValidationError(errors);
    }
    // Sadece rakam, +, -, (, ), boşluk karakterlerine izin ver
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!phoneRegex.test(phone)) {
        errors.push({ field: fieldName, message: 'Phone number contains invalid characters' });
    }
    // Minimum uzunluk kontrolü (rakamlar)
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
        errors.push({ field: fieldName, message: 'Phone number must be at least 10 digits' });
    }
    if (digitsOnly.length > 15) {
        errors.push({ field: fieldName, message: 'Phone number exceeds maximum length (15 digits)' });
    }
    if (errors.length > 0) {
        throw new cargo_errors_1.CargoValidationError(errors);
    }
};
exports.validatePhone = validatePhone;
/**
 * Desi hesaplama
 * @param dimensions - Boyut bilgileri
 * @returns Desi değeri
 */
const calculateDesi = (dimensions) => {
    // cm cinsinden normalize et
    let lengthInCm = dimensions.length;
    let widthInCm = dimensions.width;
    let heightInCm = dimensions.height;
    if (dimensions.unit === 'm') {
        lengthInCm = dimensions.length * 100;
        widthInCm = dimensions.width * 100;
        heightInCm = dimensions.height * 100;
    }
    // Desi = (Uzunluk × Genişlik × Yükseklik) / 3000
    const desi = (lengthInCm * widthInCm * heightInCm) / 3000;
    return Math.ceil(desi); // Yukarı yuvarla
};
exports.calculateDesi = calculateDesi;
/**
 * Shipping number format validasyonu
 * @param shippingNumber - Kargo numarası
 * @throws CargoValidationError
 */
const validateShippingNumber = (shippingNumber) => {
    const errors = [];
    if (!shippingNumber || shippingNumber.trim() === '') {
        errors.push({ field: 'shippingNumber', message: 'Shipping number is required' });
    }
    // Minimum uzunluk kontrolü
    if (shippingNumber && shippingNumber.length < 5) {
        errors.push({ field: 'shippingNumber', message: 'Shipping number must be at least 5 characters' });
    }
    if (errors.length > 0) {
        throw new cargo_errors_1.CargoValidationError(errors);
    }
};
exports.validateShippingNumber = validateShippingNumber;
//# sourceMappingURL=cargo-validators.js.map