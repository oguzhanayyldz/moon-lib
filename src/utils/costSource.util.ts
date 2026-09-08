import { CostSource, costSourcePrecedence } from '../common/types/cost-source';

/**
 * Yeni bir maliyet kaynagi mevcut degeri ezebilir mi? (issue #681, epic #677)
 *
 * NEDEN moon-lib'DE, TEK YERDE:
 * Bu kurali her servis kendi icinde yazsaydi zamanla catallasirdi — inventory katman
 * tuketiminde, orders siparis yaziminda, pricing sabit maliyet akisinda ayni soruyu
 * soruyor. Kural bir yerde bozulursa hepsi bozulmali, sessizce ayrismamali.
 *
 * KURALLAR:
 * 1. Mevcut deger yoksa her kaynak yazabilir (bos alan doldurulur)
 * 2. `Manual` en yuksek kesinlige sahiptir — hicbir otomatik kaynak onu gecemez
 * 3. Esit kesinlikteki kaynak KENDINI EZEBILIR: ayni kaynaktan gelen daha yeni veri
 *    gecerlidir (fatura duzeltmesi, hakedis guncellemesi, kullanicinin ikinci girisi)
 * 4. Daha dusuk kesinlikteki kaynak daha yuksegi ezemez
 */
export function canOverrideCost(
    current: CostSource | undefined | null,
    incoming: CostSource
): boolean {
    if (!current) return true;

    const mevcut = costSourcePrecedence[current];
    const gelen = costSourcePrecedence[incoming];

    // Haritada karsiligi olmayan bir deger (eski kayit, elle bozulmus veri, haritaya
    // yazilmadan eklenmis yeni kaynak) sessizce `undefined` uretirdi ve her iki
    // karsilastirma da `false` donerdi — alan bir daha HIC guncellenemezdi, Manual bile
    // yazamazdi. Bu bir "yazma kaybi" olarak gorunur, hata olarak degil.
    if (typeof mevcut !== 'number') {
        // Mevcut deger taninmiyor: yeni ve gecerli bir kaynak yazabilmeli
        return typeof gelen === 'number';
    }
    if (typeof gelen !== 'number') return false;

    return gelen >= mevcut;
}
