/**
 * Integration komutları için merkezi konfigürasyon
 *
 * OPTIONAL_COMMANDS: Desteklenmese bile hata fırlatmayan komutlar
 * Bu komutlar için graceful handling yapılır (boş sonuç döner)
 */

/**
 * Opsiyonel komutlar - desteklenmese bile hata gösterilmez
 * Yeni özellikler eklendiğinde buraya eklenmeli
 */
export const OPTIONAL_INTEGRATION_COMMANDS = [
    'fetchLocations',     // Location/warehouse listesi çekme (e-commerce, ERP)
    'getShop',            // Mağaza bilgisi (bazı platformlarda olmayabilir)
    'getCustomers'        // Müşteri listesi (bazı platformlarda olmayabilir)
] as const;

/**
 * Bir komutun opsiyonel olup olmadığını kontrol eder
 * @param command - Kontrol edilecek komut
 * @returns Komut opsiyonel ise true
 */
export function isOptionalCommand(command: string): boolean {
    return OPTIONAL_INTEGRATION_COMMANDS.includes(command as any);
}

/**
 * Komut desteklenmiyorsa graceful handling için varsayılan yanıt
 */
export const UNSUPPORTED_COMMAND_RESPONSE = {
    success: true,
    data: []
};
