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
    'getCustomers', // Müşteri listesi (bazı platformlarda olmayabilir)
    'createProducts', // Toplu ürün oluşturma
    'updateProducts', // Toplu ürün güncelleme
    'updateOrderStatus', // Sipariş statü güncelleme
    'cancelOrder', // Sipariş iptali (bazı platformlar desteklemez)
    'syncBrands', // Marka senkronizasyonu (bazı platformlar desteklemez)
    'syncOrderStatuses', // Sipariş statüleri senkronizasyonu
    'syncSingleOrderStatus', // Tekli sipariş statü senkronizasyonu
    'getShippingLabel', // Kargo etiketi alma
    'sendInvoice', // Fatura gönderme
    'sendTracking', // Kargo takip bilgisi gönderme
    'syncCategories', // Kategori senkronizasyonu (marketplace)
    'syncCategoryAttributes', // Kategori attribute senkronizasyonu (marketplace)
    'getCategories', // Kategori listesi (marketplace)
    'getCategoryAttributes', // Kategori attribute listesi (marketplace)
    'getReturnReasons', // İade red sebepleri (marketplace)
    'approveReturn', // İade onaylama (marketplace)
    'rejectReturn', // İade reddetme (marketplace)
    'getOrderById', // Sipariş detayı getirme (marketplace)
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
