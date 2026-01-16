/**
 * @description ExternalLocation - Entegrasyonlardan dönen lokasyon/depo bilgisinin standart formatı
 * @description Tüm entegrasyonlar (Shopify, ERP vs.) location bilgisini bu formatta döndürür
 * @author Oğuzhan Ayyıldız
 * @date 16/01/2026
 */

export interface ExternalLocation {
    id: string;                       // Entegrasyon tarafındaki unique ID (örn: gid://shopify/Location/123)
    name: string;                     // Lokasyon/depo adı
    address?: string;                 // Adres bilgisi (opsiyonel, formatted string)
    isActive: boolean;                // Lokasyon aktif mi?
    metadata?: Record<string, any>;   // Entegrasyona özel extra bilgiler (full address object, timezone vs.)
}

/**
 * @description ILocationFetchable - Location fetch desteği olan entegrasyonların implement etmesi gereken interface
 * @description Bu interface'i implement eden her entegrasyon fetchLocations() metodunu sağlamalıdır
 * @author Oğuzhan Ayyıldız
 * @date 16/01/2026
 */

export interface ILocationFetchable {
    /**
     * Entegrasyondan lokasyon/depo listesini çeker
     * @returns ExternalLocation array
     * @throws Error - Entegrasyon API hatası durumunda
     */
    fetchLocations(): Promise<ExternalLocation[]>;
}
