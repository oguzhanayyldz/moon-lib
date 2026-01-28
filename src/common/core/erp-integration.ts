import { IntegrationType } from "../types/integration-type";
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
export abstract class ErpIntegration extends BaseIntegration {
    constructor () {
        super();
        this.type = IntegrationType.Erp;
    }

    // === ERP-specific abstract metodlar ===

    /**
     * Ürünleri/Stok kartlarını ERP sisteminden çeker veya ERP'ye gönderir
     */
    protected abstract syncProducts(): Promise<void>;

    /**
     * Sipariş verilerinden fatura oluşturur
     */
    protected abstract createInvoice(orderData: any): Promise<string>;

    /**
     * Oluşturulan faturayı resmileştirir (e-Arşiv veya e-Fatura)
     */
    protected abstract formalizeInvoice?(params: { erpId: string; category?: string; invoiceData?: any }): Promise<any>;

    /**
     * Cari hesapları (müşteri/tedarikçi) senkronize eder
     */
    protected abstract syncContacts(): Promise<void>;

    /**
     * Stok miktarını günceller
     */
    protected abstract updateStock(sku: string, quantity: number): Promise<void>;

    /**
     * Fiyat günceller
     */
    protected abstract updatePrice?(sku: string, price: number): Promise<void>;

    /**
     * Fatura kesme bakiyesi/kotasını kontrol eder
     */
    protected abstract checkBalance?(): Promise<number>;

    /**
     * ERP sistemindeki faturayı siler
     */
    protected abstract deleteInvoice?(erpId: string): Promise<{ success: boolean; message?: string }>;
}
