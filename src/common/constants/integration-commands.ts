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
    'getCustomers',       // Müşteri listesi (bazı platformlarda olmayabilir)
    'createProducts',     // Toplu ürün oluşturma
    'updateProducts',     // Toplu ürün güncelleme
    'updateOrderStatus',  // Sipariş statü güncelleme
    'cancelOrder',        // Sipariş iptali (bazı platformlar desteklemez)
    'syncBrands',         // Marka senkronizasyonu (bazı platformlar desteklemez)
    'syncOrderStatuses',  // Sipariş statüleri senkronizasyonu
    'syncSingleOrderStatus', // Tekli sipariş statü senkronizasyonu
    'getShippingLabel',   // Kargo etiketi alma
    'sendInvoice',        // Fatura gönderme
    'sendTracking',       // Kargo takip bilgisi gönderme
    'syncCategories',     // Kategori senkronizasyonu (marketplace)
    'syncCategoryAttributes', // Kategori attribute senkronizasyonu (marketplace)
    'getCategories',      // Kategori listesi (marketplace)
    'getCategoryAttributes', // Kategori attribute listesi (marketplace)
    'getReturnReasons',   // İade red sebepleri (marketplace)
    'approveReturn',      // İade onaylama (marketplace)
    'rejectReturn',       // İade reddetme (marketplace)
    'getOrderById',       // Sipariş detayı getirme (marketplace)
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
