/**
 * Optimistic locking için retry utility fonksiyonu
 * Version conflict durumlarında işlemi yeniden dener
 */
export declare class OptimisticLockingUtil {
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
    static retryWithOptimisticLocking<T>(operation: () => Promise<T>, maxRetries?: number, backoffMs?: number, operationName?: string): Promise<T>;
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
    static saveWithRetry<T extends {
        save(): Promise<any>;
        id?: string;
    }>(document: T, operationName?: string): Promise<T>;
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
    static updateWithRetry<T>(Model: any, id: string, updateFields: any, options?: any, operationName?: string): Promise<T>;
}
//# sourceMappingURL=optimisticLocking.util.d.ts.map