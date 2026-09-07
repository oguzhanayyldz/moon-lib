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
    // Alış faturasından stok girişi (issue #638)
    // Addition'dan AYRI: Addition elle yapılan genel stok girişidir, bunun bir alış
    // fiyatı ve tedarikçisi yoktur. Purchase kayıtları referenceId ile fatura kalemine
    // bağlanır — "ne zaman girdi, kaça girdi" sorgusu bu ayrım olmadan yapılamaz.
    Purchase = "purchase",
    // Diğer değişimler
    Other = "other"
}