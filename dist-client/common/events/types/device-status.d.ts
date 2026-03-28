/**
 * Araç Durumu
 * Depo araçlarının mevcut durumunu belirler
 */
export declare enum DeviceStatus {
    /** Kullanılabilir durumda */
    Available = "Available",
    /** Kullanımda */
    InUse = "InUse",
    /** Bakımda */
    Maintenance = "Maintenance",
    /** Servis dışı */
    OutOfService = "OutOfService"
}
