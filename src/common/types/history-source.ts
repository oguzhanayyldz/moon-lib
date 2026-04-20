/**
 * Entity tarihçe kaydi (ProductHistory, CatalogMappingHistory) degisimlerinin kaynagi.
 * Fiyat/stok gecmisleri kendi source enum'larini kullanir (PriceChangeSource, StockActionType).
 */
export enum HistoryChangeSource {
    Manual = "MANUAL",           // Kullanici UI/API
    Integration = "INTEGRATION", // Marketplace sync (entegrasyon)
    Automation = "AUTOMATION",   // Otomatik kural
    System = "SYSTEM",           // Sistem icsel degisim
    Excel = "EXCEL",             // Excel import/export
    Api = "API"                  // Direct API call (3P)
}
