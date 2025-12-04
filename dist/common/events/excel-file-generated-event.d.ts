import { Subjects } from './subjects';
export interface ExcelFileGeneratedEvent {
    subject: Subjects.ExcelFileGenerated;
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
         * Excel dosya buffer (base64 encoded)
         */
        fileBuffer: string;
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
