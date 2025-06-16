export enum ReturnStatus {
    None = 'none',                    // İade yok
    Requested = 'requested',          // İade talep edildi
    Approved = 'approved',            // İade onaylandı
    InProgress = 'in_progress',       // İade işlemi devam ediyor
    Received = 'received',            // İade ürün teslim alındı
    Refunded = 'refunded',           // Para iadesi yapıldı
    Rejected = 'rejected',           // İade reddedildi
    Cancelled = 'cancelled'          // İade iptal edildi
}
