/**
 * Integration işlemlerinin türlerini belirten enum
 * Log kayıtlarının kategorize edilmesi ve filtrelenmesi için kullanılır
 */
export enum OperationType {
    // Ürün İşlemleri
    SEND_PRODUCTS = 'SEND_PRODUCTS',
    FETCH_PRODUCTS = 'FETCH_PRODUCTS',
    UPDATE_PRODUCTS = 'UPDATE_PRODUCTS',
    DELETE_PRODUCTS = 'DELETE_PRODUCTS',
    CHECK_PRODUCT_STATUS = 'CHECK_PRODUCT_STATUS',

    // Batch İşlemleri
    GET_BATCH_STATUS = 'GET_BATCH_STATUS',
    CREATE_BATCH_REQUEST = 'CREATE_BATCH_REQUEST',

    // Kategori ve Marka İşlemleri
    GET_CATEGORIES = 'GET_CATEGORIES',
    GET_BRANDS = 'GET_BRANDS',
    GET_CATEGORY_ATTRIBUTES = 'GET_CATEGORY_ATTRIBUTES',

    // Stok İşlemleri
    CHECK_STOCK = 'CHECK_STOCK',
    UPDATE_STOCK = 'UPDATE_STOCK',
    SYNC_STOCK = 'SYNC_STOCK',
    UPDATE_STOCK_AND_PRICE = 'UPDATE_STOCK_AND_PRICE', // Hem stok hem fiyat güncelleme (Trendyol için)

    // Sipariş İşlemleri
    CREATE_ORDER = 'CREATE_ORDER',
    UPDATE_ORDER = 'UPDATE_ORDER',
    CANCEL_ORDER = 'CANCEL_ORDER',
    FETCH_ORDERS = 'FETCH_ORDERS',

    // Kargo/Tracking İşlemleri
    SEND_TRACKING = 'SEND_TRACKING',          // Kargo takip numarası gönderme (InTransit)
    DELIVER_ORDER = 'DELIVER_ORDER',          // Teslim durumu bildirme

    // Paketleme İşlemleri (Hepsiburada)
    CHECK_PACKAGEABLE_ITEMS = 'CHECK_PACKAGEABLE_ITEMS', // Birlikte paketlenebilecek ürünleri kontrol et
    CREATE_PACKAGE = 'CREATE_PACKAGE',                   // Paket oluştur
    FETCH_PACKAGES = 'FETCH_PACKAGES',                   // Paketleri listele
    SPLIT_PACKAGE = 'SPLIT_PACKAGE',                     // Paketi böl
    UNPACK_PACKAGE = 'UNPACK_PACKAGE',                   // Paketi aç
    CANCEL_LINE_ITEM = 'CANCEL_LINE_ITEM',               // Line item iptal et

    // Fiyat İşlemleri
    UPDATE_PRICES = 'UPDATE_PRICES',
    FETCH_PRICES = 'FETCH_PRICES',

    // Fatura İşlemleri
    SEND_INVOICES = 'SEND_INVOICES',
    FETCH_INVOICES = 'FETCH_INVOICES',
    CANCEL_INVOICE = 'CANCEL_INVOICE',

    // Diğer İşlemler
    HEALTH_CHECK = 'HEALTH_CHECK',
    READ = 'READ',
    OTHER = 'OTHER'
}
