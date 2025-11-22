import { BaseIntegration } from "./base-integration";
/**
 * ERP Integration Base Class
 *
 * ERP (Enterprise Resource Planning) entegrasyonları için temel sınıf.
 * Marketplace ve E-commerce entegrasyonlarından farklı olarak:
 * - Siparişleri çekmek yerine ERP'ye gönderir (fatura kesme)
 * - Ürün/stok kartı senkronizasyonu
 * - Cari (müşteri/tedarikçi) yönetimi
 * - Fatura resmileştirme işlemleri (e-Arşiv, e-Fatura)
 *
 * @abstract
 * @extends BaseIntegration
 */
export declare abstract class ErpIntegration extends BaseIntegration {
    constructor();
    /**
     * Ürünleri/Stok kartlarını ERP sisteminden çeker veya ERP'ye gönderir
     * @abstract
     */
    protected abstract syncProducts(): Promise<void>;
    /**
     * Sipariş verilerinden fatura oluşturur
     * ERP sistemlerinde temel işlemlerden biri
     *
     * @param orderData - Sipariş verileri (CommonOrderExport formatında)
     * @returns Oluşturulan fatura ID'si
     * @abstract
     */
    protected abstract createInvoice(orderData: any): Promise<string>;
    /**
     * Oluşturulan faturayı resmileştirir (e-Arşiv veya e-Fatura)
     * Bazı ERP sistemlerinde ayrı bir adım olarak gereklidir
     *
     * @param params - Resmileştirme parametreleri (erpId, category, invoiceData vb.)
     * @returns Resmileştirme sonucu
     * @abstract
     * @optional - Bazı ERP sistemlerinde otomatik olabilir
     */
    protected abstract formalizeInvoice?(params: {
        erpId: string;
        category?: string;
        invoiceData?: any;
    }): Promise<any>;
    /**
     * Cari hesapları (müşteri/tedarikçi) senkronize eder
     * @abstract
     */
    protected abstract syncContacts(): Promise<void>;
    /**
     * Stok miktarını günceller
     *
     * @param sku - Ürün SKU/Barkod
     * @param quantity - Yeni stok miktarı
     * @abstract
     */
    protected abstract updateStock(sku: string, quantity: number): Promise<void>;
    /**
     * Fiyat günceller
     *
     * @param sku - Ürün SKU/Barkod
     * @param price - Yeni fiyat
     * @abstract
     * @optional - Bazı ERP sistemlerinde fiyat yönetimi farklı olabilir
     */
    protected abstract updatePrice?(sku: string, price: number): Promise<void>;
    /**
     * Fatura kesme bakiyesi/kotasını kontrol eder
     * Bazı ERP sistemlerinde (örn: Paraşüt) fatura kesme için bakiye gerekebilir
     *
     * @returns Kalan fatura kesme hakkı veya bakiye
     * @abstract
     * @optional
     */
    protected abstract checkBalance?(): Promise<number>;
}
//# sourceMappingURL=erp-integration.d.ts.map