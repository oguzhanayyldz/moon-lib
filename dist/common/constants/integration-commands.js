"use strict";
/**
 * Integration komutları için merkezi konfigürasyon
 *
 * OPTIONAL_COMMANDS: Desteklenmese bile hata fırlatmayan komutlar
 * Bu komutlar için graceful handling yapılır (boş sonuç döner)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UNSUPPORTED_COMMAND_RESPONSE = exports.OPTIONAL_INTEGRATION_COMMANDS = void 0;
exports.isOptionalCommand = isOptionalCommand;
/**
 * Opsiyonel komutlar - desteklenmese bile hata gösterilmez
 * Yeni özellikler eklendiğinde buraya eklenmeli
 */
exports.OPTIONAL_INTEGRATION_COMMANDS = [
    'fetchLocations', // Location/warehouse listesi çekme (e-commerce, ERP)
    'getShop', // Mağaza bilgisi (bazı platformlarda olmayabilir)
    'getCustomers' // Müşteri listesi (bazı platformlarda olmayabilir)
];
/**
 * Bir komutun opsiyonel olup olmadığını kontrol eder
 * @param command - Kontrol edilecek komut
 * @returns Komut opsiyonel ise true
 */
function isOptionalCommand(command) {
    return exports.OPTIONAL_INTEGRATION_COMMANDS.includes(command);
}
/**
 * Komut desteklenmiyorsa graceful handling için varsayılan yanıt
 */
exports.UNSUPPORTED_COMMAND_RESPONSE = {
    success: true,
    data: []
};
