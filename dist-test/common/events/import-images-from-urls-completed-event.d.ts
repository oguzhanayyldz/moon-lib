import { Subjects } from './subjects';
export interface ImportImagesFromUrlsCompletedEvent {
    subject: Subjects.ImportImagesFromUrlsCompleted;
    data: {
        /**
         * İşlem için benzersiz istek ID'si
         */
        requestId: string;
        /**
         * Kullanıcı ID'si
         */
        userId: string;
        /**
         * Toplam işlenen URL sayısı
         */
        totalUrls: number;
        /**
         * Başarıyla işlenen URL sayısı
         */
        successful: number;
        /**
         * Başarısız olan URL sayısı
         */
        failed: number;
        /**
         * Tekli ürün için productId (eski yapı için geriye dönük uyumluluk)
         */
        productId?: string;
        /**
         * URL -> ProductId eşleştirme haritası (toplu işleme için)
         * Her URL'nin hangi ürüne ait olduğunu belirtir
         */
        productIdMap?: Record<string, string>;
        /**
         * İşlem sonuçları
         */
        images: Array<{
            /**
             * CDN görseli ID'si
             */
            id?: string;
            /**
             * Kaynak URL
             */
            sourceUrl: string;
            /**
             * CDN URL'si
             */
            url?: string;
            /**
             * Dosya adı
             */
            filename?: string;
            /**
             * Orijinal dosya adı
             */
            originalname?: string;
            /**
             * MIME tipi
             */
            mimetype?: string;
            /**
             * Dosya boyutu
             */
            size?: number;
            /**
             * Başarı durumu
             */
            success: boolean;
            /**
             * Hata mesajı (başarısız olursa)
             */
            error?: string;
            /**
             * Görsel ile ilişkili ürün ID'si
             */
            productId?: string;
            /**
             * Görsel zaten var olduğu için atlandı mı
             */
            skipped?: boolean;
        }>;
        /**
         * İşlem zaman damgası
         */
        timestamp?: string;
    };
}
//# sourceMappingURL=import-images-from-urls-completed-event.d.ts.map