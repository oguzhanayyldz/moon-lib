import { logger } from "../services/logger.service";

/**
 * Optimistic locking için retry utility fonksiyonu
 * Version conflict durumlarında işlemi yeniden dener
 */
export class OptimisticLockingUtil {
    
    /**
     *
     *
     * @static
     * @template T
     * @param {() => Promise<T>} operation
     * @param {number} [maxRetries=3]
     * @param {number} [backoffMs=100]
     * @param {string} [operationName='operation']
     * @return {*}  {Promise<T>}
     * @memberof OptimisticLockingUtil
     * @description retryWithOptimisticLocking<T>: Versiyon çakışmalarında işlemlerin tekrar denenmesini sağlayan ana fonksiyon. Şu özelliklere sahiptir:
            Üstel gecikme (exponential backoff) stratejisi kullanır
            Maksimum yeniden deneme sayısı parametrik olarak ayarlanabilir (varsayılan: 3)
            İlk gecikme süresi parametrik olarak ayarlanabilir (varsayılan: 100ms)
            Operasyon adı ile detaylı loglama yapar
     */
    static async retryWithOptimisticLocking<T>(
        operation: () => Promise<T>,
        maxRetries: number = 3,
        backoffMs: number = 100,
        operationName: string = 'operation'
    ): Promise<T> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await operation();
                if (attempt > 1) {
                    logger.info(`${operationName} başarılı (attempt ${attempt}/${maxRetries})`);
                }
                return result;
            } catch (error) {
                const isVersionError = error instanceof Error && (
                    error.message.includes('version') ||
                    error.message.includes('VersionError') ||
                    error.message.includes('No matching document found')
                );

                if (isVersionError && attempt < maxRetries) {
                    const delayMs = backoffMs * Math.pow(2, attempt - 1); // Exponential backoff
                    logger.warn(`${operationName} version conflict (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                    continue;
                }
                
                // Son deneme veya version error değilse hatayı fırlat
                logger.error(`${operationName} failed after ${attempt} attempts:`, error);
                throw error;
            }
        }
        
        throw new Error(`${operationName}: Maximum retry attempts (${maxRetries}) reached`);
    }

    /**
    *
    *
    * @static
    * @template T
    * @param {T} document
    * @param {string} [operationName]
    * @return {*}  {Promise<T>}
    * @memberof OptimisticLockingUtil
    * @description saveWithRetry<T>: Bir MongoDB dokümanını kaydetmek için optimize edilmiş retry mekanizması.
            Doküman save() işlemini yeniden deneme mantığı ile güçlendirir
            İşlem adını ve doküman ID'sini loglama için kullanır
    */
    static async saveWithRetry<T extends { save(): Promise<any>; id?: string }>(
        document: T,
        operationName?: string
    ): Promise<T> {
        const docName = operationName || `Document ${document.id || 'unknown'}`;
        
        return await this.retryWithOptimisticLocking(
            async () => {
                await document.save();
                return document;
            },
            3,
            100,
            `${docName} save`
        );
    }

    /**
    *
    *
    * @static
    * @template T
    * @param {any} Model
    * @param {string} id
    * @param {any} updateFields
    * @param {any} [options={}]
    * @param {string} [operationName]
    * @return {*}  {Promise<T>}
    * @memberof OptimisticLockingUtil
    * @description updateWithRetry<T>: findByIdAndUpdate işlemi için özel retry mekanizması.
            Belirli bir ID ile doküman güncellemelerinde kullanılır
            omitUndefined ve new:true gibi yaygın MongoDB seçeneklerini varsayılan olarak sunar
            Doküman bulunamazsa uygun hata fırlatır
    */
    static async updateWithRetry<T>(
        Model: any,
        id: string,
        updateFields: any,
        options: any = {},
        operationName?: string
    ): Promise<T> {
        const docName = operationName || `${Model.modelName} ${id}`;
        
        return await this.retryWithOptimisticLocking(
            async () => {
                const result = await Model.findByIdAndUpdate(
                    id, 
                    updateFields, 
                    { new: true, omitUndefined: true, ...options }
                );
                
                if (!result) {
                    throw new Error(`Document not found: ${id}`);
                }
                
                return result;
            },
            3,
            100,
            `${docName} update`
        );
    }
}