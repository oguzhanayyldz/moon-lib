export enum StockActionType {
    // Stok ekleme
    Addition = "addition",
    // Stok çıkarma
    Removal = "removal",
    // Stoklar arası transfer
    Transfer = "transfer",
    // Stok düzeltme
    Adjustment = "adjustment",
    // Sipariş rezervasyonu
    OrderReservation = "order_reservation",
    // Sipariş iptal
    OrderCancel = "order_cancel",
    // Sipariş tamamlama
    OrderComplete = "order_complete",
    // Stok sayımı
    Inventory = "inventory",
    // Ürün iade
    Return = "return",
    // Seri numarası kontrolü 
    SerialNumberCheck = "serial_number_check",
    // Diğer değişimler
    Other = "other"
}