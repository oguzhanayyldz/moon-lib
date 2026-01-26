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

// ===== HEPSIBURADA KARGO DESTEĞİ =====

/** Hepsiburada ortak barkod destekleyen kargo firmaları */
export const HEPSIBURADA_SUPPORTED_CARGOS = ['HepsiJet', 'hepsijet', 'Aras', 'aras', 'ARAS'];

/** Hepsiburada Mağaza Hesabı (kendi kargo) - Platform etiketi kullanılamaz */
export const HEPSIBURADA_STORE_ACCOUNT_ID = 89100;

/**
 * Hepsiburada kargo firmasının ortak barkod desteği var mı kontrol eder
 * @param cargoCompanyName - Kargo firması adı
 * @returns true: Destekliyor, false: Desteklemiyor
 */
export function hasHepsiburadaLabelSupport(cargoCompanyName: string | undefined | null): boolean {
    if (!cargoCompanyName) return false; // Bilinmiyorsa desteklemiyor kabul et
    const lowerName = cargoCompanyName.toLowerCase();
    return lowerName.includes('hepsijet') || lowerName.includes('aras');
}

/**
 * Hepsiburada siparişinin Mağaza Hesabı (kendi kargo) olup olmadığını kontrol eder
 * @param cargoCompanyId - Kargo firma ID'si
 * @returns true: Mağaza Hesabı, false: Normal kargo
 */
export function isHepsiburadaStoreAccount(cargoCompanyId: number | string | undefined | null): boolean {
    if (!cargoCompanyId) return false;
    const numericId = typeof cargoCompanyId === 'string' ? parseInt(cargoCompanyId, 10) : cargoCompanyId;
    return numericId === HEPSIBURADA_STORE_ACCOUNT_ID;
}

// ===== TRENDYOL KARGO DESTEĞİ =====

/** Trendyol ortak etiket destekleyen kargo firmaları */
export const TRENDYOL_SUPPORTED_CARGOS = ['TEX', 'tex', 'TrendyolExpress', 'Aras', 'aras'];

/**
 * Trendyol kargo firmasının ortak etiket desteği var mı kontrol eder
 * @param cargoProviderCode - Kargo firma kodu
 * @returns true: Destekliyor, false: Desteklemiyor
 */
export function hasTrendyolLabelSupport(cargoProviderCode: string | undefined | null): boolean {
    if (!cargoProviderCode) return false;
    const lowerCode = cargoProviderCode.toLowerCase();
    return lowerCode.includes('tex') || lowerCode.includes('trendyol') || lowerCode.includes('aras');
}

// ===== KULLANICI DOSTU HATA MESAJLARI =====

/** Kargo barkod desteği olmadığında gösterilecek mesajlar */
export const CARGO_NO_LABEL_MESSAGES = {
    /** Hepsiburada - Desteklenmeyen kargo firması */
    hepsiburada_no_support: 'Bu kargo firması ortak barkod desteklemiyor. Sadece HepsiJet ve Aras destekliyor.',

    /** Hepsiburada - Mağaza Hesabı siparişi */
    hepsiburada_store_account: 'Mağaza Hesabı siparişlerinde platform etiketi kullanılamaz.',

    /** Trendyol - Desteklenmeyen kargo firması */
    trendyol_no_support: 'Bu kargo firması ortak etiket desteklemiyor. Sadece TEX ve Aras (trendyol öder) destekliyor.',

    /** Genel mesaj */
    generic: 'Bu kargo firması platform üzerinden barkod desteği sunmuyor.'
};

/**
 * Platform ve kargo bilgisine göre uygun hata mesajını döndürür
 * @param platform - Platform adı (Hepsiburada, Trendyol)
 * @param isStoreAccount - Mağaza Hesabı mı
 * @returns Kullanıcı dostu hata mesajı
 */
export function getCargoNoLabelMessage(platform: string, isStoreAccount: boolean = false): string {
    if (platform.toLowerCase().includes('hepsiburada')) {
        return isStoreAccount
            ? CARGO_NO_LABEL_MESSAGES.hepsiburada_store_account
            : CARGO_NO_LABEL_MESSAGES.hepsiburada_no_support;
    }
    if (platform.toLowerCase().includes('trendyol')) {
        return CARGO_NO_LABEL_MESSAGES.trendyol_no_support;
    }
    return CARGO_NO_LABEL_MESSAGES.generic;
}
