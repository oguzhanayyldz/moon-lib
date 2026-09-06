import { Subjects } from "./subjects";
/**
 * Urun maliyeti guncellendi (issue #638)
 *
 * Yayinlayan: inventory (alis faturasi kaydedilince, kalem basina 1 Outbox kaydi)
 * Dinleyen:   pricing (Price.costPrice'a yazar)
 *
 * NEDEN MALIYET INVENTORY'DE HESAPLANIYOR:
 * Hareketli ortalama formulu `(mevcutStok x mevcutMaliyet + girenMiktar x girenFiyat) /
 * (mevcutStok + girenMiktar)` seklindedir. "mevcutStok" girdisi ProductStock'tur ve
 * ProductStock inventory'ye NATIVE'dir — pricing oraya erisemez (Kural 2). Bu yuzden
 * hesap inventory'de yapilir, sonuc event ile pricing'e tasinir.
 *
 * NEDEN ProductPriceUpdated YENIDEN KULLANILMADI:
 * O event satis fiyati akisinin parcasi; payload'i `price` zorunlu kilar ve pricing
 * tarafinda fiyat senkron zincirini (integration'a fiyat gonderme) tetikler. Maliyet
 * degisimi pazaryerine gonderilmez — satis fiyatini degistirmez. Ayni event'e binmek
 * her alis faturasinda tum platformlara gereksiz fiyat push'u anlamina gelirdi.
 */
export interface ProductCostUpdatedEvent {
    subject: Subjects.ProductCostUpdated;
    data: {
        user: string;
        product: string;
        /** Varyantli urunlerde varyant id'si; yoksa alan gonderilmez */
        combination?: string;
        /** Hesaplanan yeni hareketli ortalama maliyet */
        averageCost: number;
        /** Onceki ortalama — pricing tarafinda log/denetim icin; ilk alista gonderilmez */
        previousAverageCost?: number;
        /** Bu faturadaki birim alis fiyati (iskonto dusulmus net) */
        lastPurchasePrice: number;
        /** Hesap aninda mevcut olan stok — formulun paydasinin ilk terimi */
        quantityBefore: number;
        /** Bu faturayla giren miktar */
        quantityAdded: number;
        /** PurchaseInvoiceItem id'si — "bu maliyet hangi kalemden dogdu" izi */
        referenceId: string;
        purchaseInvoiceId: string;
    };
}
