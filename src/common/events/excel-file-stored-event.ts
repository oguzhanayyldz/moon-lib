import { Subjects } from './subjects';

export interface ExcelFileStoredEvent {
  subject: Subjects.ExcelFileStored;
  data: {
    /**
     * İşlem için benzersiz istek ID'si (ExcelJob ID)
     */
    requestId: string;

    /**
     * Kullanıcı ID'si
     */
    userId: string;

    /**
     * Excel job ID
     */
    jobId: string;

    /**
     * Servis adı (products, orders, inventory, etc.)
     */
    serviceName: string;

    /**
     * Excel dosya adı
     */
    filename: string;

    /**
     * CDN'de kayıtlı dosya URL'si
     */
    fileUrl: string;

    /**
     * Başarı durumu
     */
    success: boolean;

    /**
     * Hata mesajı (başarısız olursa)
     */
    error?: string;

    /**
     * İşlem tipi (export/import)
     */
    type: 'export' | 'import';

    /**
     * İşlem zaman damgası
     */
    timestamp: Date;
  };
}
