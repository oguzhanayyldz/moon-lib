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
export declare const OPTIONAL_INTEGRATION_COMMANDS: readonly ["fetchLocations", "getShop", "getCustomers", "createProducts", "updateProducts", "updateOrderStatus", "cancelOrder", "syncBrands", "syncOrderStatuses", "syncSingleOrderStatus", "getShippingLabel", "sendInvoice", "sendTracking", "syncCategories", "syncCategoryAttributes", "getCategories", "getCategoryAttributes", "getReturnReasons", "approveReturn", "rejectReturn", "getOrderById"];
/**
 * Bir komutun opsiyonel olup olmadığını kontrol eder
 * @param command - Kontrol edilecek komut
 * @returns Komut opsiyonel ise true
 */
export declare function isOptionalCommand(command: string): boolean;
/**
 * Komut desteklenmiyorsa graceful handling için varsayılan yanıt
 */
export declare const UNSUPPORTED_COMMAND_RESPONSE: {
    success: boolean;
    data: never[];
};
//# sourceMappingURL=integration-commands.d.ts.map