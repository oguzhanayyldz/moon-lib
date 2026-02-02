/**
 * Araç Durumu
 * Depo araçlarının mevcut durumunu belirler
 */
export enum DeviceStatus {
    /** Kullanılabilir durumda */
    Available = "Available",
    /** Kullanımda */
    InUse = "InUse",
    /** Bakımda */
    Maintenance = "Maintenance",
    /** Servis dışı */
    OutOfService = "OutOfService"
}
