/**
 * Kargo Barkod/Etiket Desteği Sabitleri
 *
 * Bu dosya, hangi kargo firmalarının platform üzerinden barkod/etiket desteği sağladığını tanımlar.
 * Platform dokümantasyonlarına göre:
 *
 * HEPSIBURADA:
 * - Ortak barkod SADECE HepsiJet ve Aras kargo destekliyor
 * - Mağaza Hesabı (cargoCompanyId = 89100) siparişlerinde platform etiketi KULLANILMAZ
 * - Diğer tüm kargolar (Yurtiçi, MNG, Sürat, PTT vb.) 400 hatası veriyor
 *
 * TRENDYOL:
 * - Ortak etiket SADECE TEX (Trendyol Express) ve Aras (trendyol öder) destekliyor
 * - Diğer kargo firmaları ortak etiket API'sini desteklemiyor
 */
/** Hepsiburada ortak barkod destekleyen kargo firmaları */
export declare const HEPSIBURADA_SUPPORTED_CARGOS: string[];
/** Hepsiburada Mağaza Hesabı (kendi kargo) - Platform etiketi kullanılamaz */
export declare const HEPSIBURADA_STORE_ACCOUNT_ID = 89100;
/**
 * Hepsiburada kargo firmasının ortak barkod desteği var mı kontrol eder
 * @param cargoCompanyName - Kargo firması adı
 * @returns true: Destekliyor, false: Desteklemiyor
 */
export declare function hasHepsiburadaLabelSupport(cargoCompanyName: string | undefined | null): boolean;
/**
 * Hepsiburada siparişinin Mağaza Hesabı (kendi kargo) olup olmadığını kontrol eder
 * @param cargoCompanyId - Kargo firma ID'si
 * @returns true: Mağaza Hesabı, false: Normal kargo
 */
export declare function isHepsiburadaStoreAccount(cargoCompanyId: number | string | undefined | null): boolean;
/** Trendyol ortak etiket destekleyen kargo firmaları */
export declare const TRENDYOL_SUPPORTED_CARGOS: string[];
/**
 * Trendyol kargo firmasının ortak etiket desteği var mı kontrol eder
 * @param cargoProviderCode - Kargo firma kodu
 * @returns true: Destekliyor, false: Desteklemiyor
 */
export declare function hasTrendyolLabelSupport(cargoProviderCode: string | undefined | null): boolean;
/** Kargo barkod desteği olmadığında gösterilecek mesajlar */
export declare const CARGO_NO_LABEL_MESSAGES: {
    /** Hepsiburada - Desteklenmeyen kargo firması */
    hepsiburada_no_support: string;
    /** Hepsiburada - Mağaza Hesabı siparişi */
    hepsiburada_store_account: string;
    /** Trendyol - Desteklenmeyen kargo firması */
    trendyol_no_support: string;
    /** Genel mesaj */
    generic: string;
};
/**
 * Platform ve kargo bilgisine göre uygun hata mesajını döndürür
 * @param platform - Platform adı (Hepsiburada, Trendyol)
 * @param isStoreAccount - Mağaza Hesabı mı
 * @returns Kullanıcı dostu hata mesajı
 */
export declare function getCargoNoLabelMessage(platform: string, isStoreAccount?: boolean): string;
//# sourceMappingURL=cargo-label-support.constants.d.ts.map