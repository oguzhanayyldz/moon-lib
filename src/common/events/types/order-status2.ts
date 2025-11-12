/**
 * OrderStatus2 - Sipariş İade ve İptal Durumu Enum
 *
 * Bu enum, siparişlerin iade ve iptal durumlarını detaylı olarak takip eder.
 * Ana OrderStatus field'ından bağımsız olarak çalışır ve özellikle:
 * - Parçalı iptal/iade durumlarını
 * - İade süreç aşamalarını (talep, onay, devam, teslim, iade)
 * - Kombinasyon durumlarını (hem iptal hem iade)
 * takip etmek için kullanılır.
 *
 * @enum {string}
 */
export enum OrderStatus2 {
    /**
     * Normal - Herhangi bir iade veya iptal durumu yok
     */
    Normal = 'normal',

    /**
     * PartialCancelled - Siparişin bir kısmı iptal edildi
     * Örnek: 3 ürünlü siparişte 1 ürün iptal edildi
     */
    PartialCancelled = 'partial_cancelled',

    /**
     * FullyCancelled - Siparişin tamamı iptal edildi
     */
    FullyCancelled = 'fully_cancelled',

    /**
     * ReturnRequested - Tüm sipariş için iade talebi oluşturuldu
     */
    ReturnRequested = 'return_requested',

    /**
     * PartialReturnRequested - Siparişin bir kısmı için iade talebi oluşturuldu
     */
    PartialReturnRequested = 'partial_return_requested',

    /**
     * ReturnApproved - Tüm sipariş için iade onaylandı
     */
    ReturnApproved = 'return_approved',

    /**
     * PartialReturnApproved - Siparişin bir kısmı için iade onaylandı
     */
    PartialReturnApproved = 'partial_return_approved',

    /**
     * ReturnInProgress - Tüm sipariş için iade işlemi devam ediyor
     */
    ReturnInProgress = 'return_in_progress',

    /**
     * PartialReturnInProgress - Siparişin bir kısmı için iade işlemi devam ediyor
     */
    PartialReturnInProgress = 'partial_return_in_progress',

    /**
     * ReturnReceived - Tüm sipariş için iade ürünleri teslim alındı
     */
    ReturnReceived = 'return_received',

    /**
     * PartialReturnReceived - Siparişin bir kısmı için iade ürünleri teslim alındı
     */
    PartialReturnReceived = 'partial_return_received',

    /**
     * ReturnRefunded - Tüm sipariş için para iadesi yapıldı
     */
    ReturnRefunded = 'return_refunded',

    /**
     * PartialReturnRefunded - Siparişin bir kısmı için para iadesi yapıldı
     */
    PartialReturnRefunded = 'partial_return_refunded',

    /**
     * ReturnRejected - İade talebi reddedildi
     */
    ReturnRejected = 'return_rejected',

    /**
     * ReturnCancelled - İade talebi iptal edildi
     */
    ReturnCancelled = 'return_cancelled',

    /**
     * CancelledAndReturned - Siparişte hem iptal hem iade durumu var
     * Örnek: 3 ürünlü siparişte 1 ürün iptal, 1 ürün iade edildi
     */
    CancelledAndReturned = 'cancelled_and_returned'
}
