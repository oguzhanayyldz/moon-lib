import { logger } from "../services/logger.service";
import { ClientSession } from 'mongoose';
import { Request } from 'express';

/**
 * Enhanced Optimistic Locking Utility
 * 
 * Version conflict durumlarında işlemleri yeniden dener ve
 * MongoDB Atlas Native Transactions ile entegrasyon sağlar.
 * 
 * Özellikler:
 * - Session-aware operasyonlar
 * - Context-aware metodlar (Request object'ten session algılama)
 * - Backward compatibility (mevcut API korunur)
 * - Transaction middleware entegrasyonu
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
            - Üstel gecikme (exponential backoff) stratejisi kullanır
            - Maksimum yeniden deneme sayısı parametrik olarak ayarlanabilir (varsayılan: 3)
            - İlk gecikme süresi parametrik olarak ayarlanabilir (varsayılan: 100ms)
            - Operasyon adı ile detaylı loglama yapar
            - Session-aware ve transaction-safe operasyon desteği
     */
    static async retryWithOptimisticLocking<T>(
        operation: () => Promise<T>,
        maxRetries: number = 5,
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
    * Session-aware saveWithRetry: MongoDB dokümanını session ile kaydetme
    * 
    * @static
    * @template T
    * @param {T} document - Kaydedilecek doküman
    * @param {string} [operationName] - İşlem adı (loglama için)
    * @param {ClientSession} [session] - MongoDB session (transaction için)
    * @param {(fresh: T) => void | Promise<void>} [reapply] - Sürüm çakışmasında değişikliği taze belgeye yeniden uygular
    * @return {Promise<T>} Kaydedilen doküman (reapply ile yeniden denendiyse TAZE belge, `document` değil)
    * @description Session-aware doküman kaydetme. Session varsa transaction içinde çalışır.
    *
    * SÜRÜM ÇAKIŞMASI (updateIfCurrentPlugin, base.schema): save `{ _id, version: <bellekteki> }` ile
    * koşullanır ve bellekteki sürüm başarısız denemeler arasında DEĞİŞMEZ. Bayat bir belgeyi tekrar
    * kaydetmek her seferinde aynı VersionError'u verir (TASK-MUEM4VTE4HLFW). Bu yüzden:
    *   - `reapply` VERİLMEDİYSE sürüm hatası ilk denemede fırlatılır (boşuna tekrar + backoff yok).
    *   - `reapply` VERİLDİYSE her tekrar denemede belge `_id` ile YENİDEN OKUNUR, `reapply(fresh)`
    *     değişikliği taze değerler üzerinden yeniden hesaplar ve taze belge kaydedilir. Eşzamanlı
    *     yazarın dokunduğu alanlar korunur. Çağıran dönüş değerini kullanmalıdır.
    *   - SESSION: `session` parametresi yoksa belgenin bağlı olduğu session (`document.$session()`,
    *     ör. `.session(s)` ile okunmuş belge) kullanılır; mongoose save de aynısını yapar
    *     (model.js:290-293). Yeniden okuma ve taze belgenin kaydı bu session ile yapılır; aksi halde
    *     transaction içindeki bir belge transaction DIŞINA yazılır ve abort onu geri almaz.
    *   - Transaction içinde de yeniden okunur (aynı session ile): orada VersionError ancak snapshot
    *     bellekteki belgeden YENİ bir sürüm içerdiğinde oluşur ve yeniden okuma o sürümü görür.
    *     Snapshot'tan sonra gelen eşzamanlı commit ise WriteConflict'tir (sürüm hatası değildir),
    *     ilk denemede fırlar ve transaction düzeyindeki yeniden deneme devralır.
    */
    static async saveWithRetry<T extends { save(options?: any): Promise<any>; id?: string }>(
        document: T,
        operationName?: string,
        session?: ClientSession,
        reapply?: (fresh: T) => void | Promise<void>
    ): Promise<T> {
        const docName = operationName || `Document ${document.id || 'unknown'}`;
        const boundSession: ClientSession | undefined =
            session ?? ((document as any).$session?.() ?? undefined);
        let attempt = 0;

        return await this.retryWithOptimisticLocking(
            async () => {
                attempt++;
                const target = attempt === 1 ? document : await this.reloadDocument(document, boundSession);
                if (attempt > 1) {
                    await reapply!(target);
                }
                const saveOptions = boundSession ? { session: boundSession } : {};
                await target.save(saveOptions);
                return target;
            },
            reapply ? 5 : 1,
            100,
            `${docName} save${boundSession ? ' (transactional)' : ''}`
        );
    }

    /**
     * saveWithRetry tekrar denemesi için belgeyi `_id` ile veritabanından yeniden okur.
     * @private
     */
    private static async reloadDocument<T>(document: T, session?: ClientSession): Promise<T> {
        const Model = (document as any).constructor;
        const id = (document as any)._id;
        if (!Model || typeof Model.findById !== 'function' || id == null) {
            throw new Error('saveWithRetry: reapply yalnız mongoose belgesiyle kullanılabilir');
        }
        const query = Model.findById(id);
        const fresh = await (session ? query.session(session) : query);
        if (!fresh) {
            throw new Error(`Document not found: ${id}`);
        }
        return fresh;
    }

    /**
    * Context-aware saveWithRetry: Request object'ten session algılama
    * 
    * @static
    * @template T
    * @param {T} document - Kaydedilecek doküman
    * @param {Request} [req] - Express Request object (session algılamak için)
    * @param {string} [operationName] - İşlem adı (loglama için)
    * @return {Promise<T>} Kaydedilen doküman
    * @description Request context'inden session'ı otomatik algılar ve transaction'da çalışır.
    */
    static async saveWithContext<T extends { save(options?: any): Promise<any>; id?: string }>(
        document: T,
        req?: Request,
        operationName?: string
    ): Promise<T> {
        const session = req && (req as any).dbSession ? (req as any).dbSession : undefined;
        return await this.saveWithRetry(document, operationName, session);
    }

    /**
    * Session-aware updateWithRetry: MongoDB model güncelleme
    * 
    * @static
    * @template T
    * @param {any} Model - Mongoose model
    * @param {string} id - Doküman ID'si
    * @param {any} updateFields - Güncellenecek alanlar
    * @param {any} [options={}] - MongoDB update seçenekleri
    * @param {string} [operationName] - İşlem adı (loglama için)
    * @param {ClientSession} [session] - MongoDB session (transaction için)
    * @return {Promise<T>} Güncellenen doküman
    * @description Session-aware doküman güncelleme. Session varsa transaction içinde çalışır.
    */
    static async updateWithRetry<T>(
        Model: any,
        id: string,
        updateFields: any,
        options: any = {},
        operationName?: string,
        session?: ClientSession
    ): Promise<T> {
        const docName = operationName || `${Model.modelName} ${id}`;

        const result = await this.retryWithOptimisticLocking(
            async () => {
                const updateOptions = {
                    new: true,
                    omitUndefined: true,
                    ...options,
                    ...(session ? { session } : {})
                };

                const updatedDoc = await Model.findByIdAndUpdate(
                    id,
                    updateFields,
                    updateOptions
                );

                if (!updatedDoc) {
                    throw new Error(`Document not found: ${id}`);
                }

                return updatedDoc;
            },
            5,
            100,
            `${docName} update${session ? ' (transactional)' : ''}`
        );

        // ✅ FIX: updateWithRetry ile version set edildiğinde EntityVersionUpdated event publish et
        // Çünkü findByIdAndUpdate post('save') hook'unu tetiklemiyor
        // Her iki format için de çalışır: { version: x } veya { $set: { version: x } }
        const targetVersion = updateFields?.$set?.version ?? updateFields?.version;
        if (targetVersion !== undefined && result) {
            try {
                await this.publishVersionEventForUpdate(Model, result, targetVersion);
            } catch (error) {
                logger.error(`❌ Failed to publish version event after updateWithRetry:`, error);
                // Event publish hatası işlemi engellemesin
            }
        }

        return result;
    }

    /**
     * Sürümü SORGUYLA ilerleten yazım (ör. `findOneAndUpdate(..., { $inc: { version: 1 } })`) için
     * EntityVersionUpdated'ı AÇIKÇA yazar. Sorgu yazımlarında EVU kancası yoktur (base.schema yalnız
     * post('save')'de üretir); util dışındaki ham sorgu yazımı sync'e bu yardımcıyla haber verir.
     *
     * - Sürüm: `options.version` verilmişse o, yoksa `doc.version` (post-image). `new: false` ile
     *   dönen ön görüntüde çağıran yeni sürümü kendisi verir: `{ version: (pre.version ?? 0) + 1 }`.
     *   `previousVersion = version - 1`.
     * - `options.session`: Outbox satırı bu session ile yazılır (transaction abort'unda EVU da geri alınır).
     * - Model sürüm izlemeli değilse sessizce `false` döner.
     * - HATA FIRLATMAZ: yayın hatası loglanır ve `false` döner; yazımı geri almaz, farkı sync döngüsü yakalar.
     *
     * @returns Outbox'a EVU yazıldıysa true
     */
    static async publishVersionEvent(
        Model: any,
        doc: any,
        options: { version?: number; session?: ClientSession; source?: string } = {}
    ): Promise<boolean> {
        const version = options.version ?? doc?.version;
        if (!doc || typeof version !== 'number' || !Number.isFinite(version)) {
            logger.error(`❌ [VERSION-EVENT] ${Model?.modelName} için sürüm yok, EVU yazılmadı`, {
                entityId: doc?.id || doc?._id?.toString()
            });
            return false;
        }
        try {
            return await this.publishVersionEventForUpdate(
                Model, doc, version, options.source ?? 'explicit', options.session
            );
        } catch (error) {
            logger.error(`❌ [VERSION-EVENT] ${Model?.modelName} EVU yazılamadı`, {
                entityId: doc.id || doc._id?.toString(),
                version,
                error: (error as Error)?.message
            });
            return false;
        }
    }

    /**
     * updateWithRetry için EntityVersionUpdated event publish eder
     * @private
     */
    private static async publishVersionEventForUpdate(
        Model: any,
        doc: any,
        newVersion: number,
        source: string = 'updateWithRetry',
        session?: ClientSession
    ): Promise<boolean> {
        const docId = doc.id || doc._id?.toString();

        // ✅ GLOBAL MAP: Config'i Map'ten al
        // base.schema.ts içindeki VERSION_TRACKING_CONFIGS Map'inden config'i oku
        const { VERSION_TRACKING_CONFIGS } = await import('../models/base/base.schema');

        // Model.modelName ile config'i bul - Order, PackageProductLink, vs.
        // Map key'i entityType (kebab-case: 'package-product-link') ile kayıtlı
        // Model.modelName PascalCase: 'PackageProductLink'
        // Normalize ederek eşleştir: tire kaldır + lowercase
        const normalize = (s: string) => s.toLowerCase().replace(/-/g, '');
        let config = null;
        for (const [key, value] of VERSION_TRACKING_CONFIGS.entries()) {
            if (normalize(key) === normalize(Model.modelName)) {
                config = value;
                break;
            }
        }

        if (!config || !config.enableVersionTracking) {
            // Version tracking enabled değilse event publish etme (sessizce skip)
            return false;
        }

        const versionTrackingConfig = config.versionTrackingConfig;
        if (!versionTrackingConfig) {
            return false;
        }

        const { entityType, serviceName } = versionTrackingConfig;

        // Outbox model'i Model'in database connection'ından al
        // Her microservice kendi MongoDB connection'ını kullanıyor
        const Outbox = Model.db.model('Outbox');

        if (!Outbox) {
            logger.warn(`⚠️ [UPDATE-WITH-RETRY-EVENT] Outbox model not found, skipping event publish`);
            return false;
        }

        const previousVersion = newVersion - 1;
        const outboxPayload = {
            eventType: 'entity:version-updated',
            payload: {
                entityType,
                entityId: docId,
                service: serviceName,
                version: newVersion,
                previousVersion,
                timestamp: new Date(),
                userId: doc.user?.toString() || doc.user,
                metadata: {
                    modelName: Model.modelName,
                    source
                }
            },
            status: 'pending'
        };

        if (session) {
            await Outbox.create([outboxPayload], { session });
        } else {
            await Outbox.create(outboxPayload);
        }
        return true;
    }

    /**
    * Context-aware updateWithRetry: Request object'ten session algılama
    *
    * @static
    * @template T
    * @param {any} Model - Mongoose model
    * @param {string} id - Doküman ID'si
    * @param {any} updateFields - Güncellenecek alanlar
    * @param {Request} [req] - Express Request object (session algılamak için)
    * @param {any} [options={}] - MongoDB update seçenekleri
    * @param {string} [operationName] - İşlem adı (loglama için)
    * @return {Promise<T>} Güncellenen doküman
    * @description Request context'inden session'ı otomatik algılar ve transaction'da çalışır.
    */
    static async updateWithContext<T>(
        Model: any,
        id: string,
        updateFields: any,
        req?: Request,
        options: any = {},
        operationName?: string
    ): Promise<T> {
        const session = req && (req as any).dbSession ? (req as any).dbSession : undefined;
        return await this.updateWithRetry(Model, id, updateFields, options, operationName, session);
    }

    /**
    * Metadata güncelleme - VERSION TRACKING OLMADAN
    *
    * Scheduler job'lar, istatistik güncellemeleri ve metadata-only operasyonlar için.
    * Version increment yapmaz; `version` verilmedikçe EntityVersionUpdated yazmaz.
    *
    * Use Cases:
    * - AutomationRule: lastRunAt, totalProcessed, totalSuccess, totalFailed
    * - Scheduler metadata: lastExecutedAt, executionCount
    * - Statistics: viewCount, downloadCount, accessCount
    * - Timestamps: lastAccessedAt, lastSyncedAt
    *
    * @static
    * @template T
    * @param {any} Model - Mongoose model
    * @param {string} id - Doküman ID'si
    * @param {any} updateFields - Güncellenecek metadata alanları ($inc, $set, $unset)
    * @param {any} [options={}] - MongoDB update seçenekleri
    * @param {string} [operationName] - İşlem adı (loglama için)
    * @param {ClientSession} [session] - MongoDB session (transaction için)
    * @return {Promise<T>} Güncellenen doküman
    * @description
    * EVU üretmez çünkü:
    * - Metadata değişiklikleri anlamlı veri değişikliği değildir
    * - Version increment gereksizdir
    * (Mekanizma: findByIdAndUpdate bir sorgu yazımıdır; base.schema EVU'yu yalnız post('save')'de
    * üretir, sorgu yazımları için kanca yoktur. "Bypass" edilen bir kanca yok — EVU'yu bu metod
    * aşağıda yalnız `version` verildiğinde açıkça yazar.)
    *
    * NOT: updateFields içinde version set edilmişse (FOREIGN entity sync gibi),
    * EntityVersionUpdated event publish eder — sync servisi haberdar olur.
    *
    * Retry mekanizması ile güvenli güncelleme sağlar:
    * - Exponential backoff stratejisi
    * - Maksimum 5 deneme
    * - Session/transaction desteği
    */
    static async updateMetadataWithRetry<T>(
        Model: any,
        id: string,
        updateFields: any,
        options: any = {},
        operationName?: string,
        session?: ClientSession
    ): Promise<T> {
        const docName = operationName || `${Model.modelName} ${id} metadata`;

        const result = await this.retryWithOptimisticLocking(
            async () => {
                const updateOptions = {
                    new: true,
                    omitUndefined: true,
                    ...options,
                    ...(session ? { session } : {})
                };

                const updatedDoc = await Model.findByIdAndUpdate(
                    id,
                    updateFields,
                    updateOptions
                );

                if (!updatedDoc) {
                    throw new Error(`Document not found: ${id}`);
                }

                return updatedDoc;
            },
            5,
            100,
            `${docName} update${session ? ' (transactional)' : ''}`
        );

        // Version set edilmişse EntityVersionUpdated event publish et (FOREIGN entity sync için)
        // Version set edilmemişse skip et (metadata-only update: scheduler, stats vb.)
        const targetVersion = updateFields?.$set?.version ?? updateFields?.version;
        if (targetVersion !== undefined && result) {
            try {
                await this.publishVersionEventForUpdate(Model, result, targetVersion);
            } catch (error) {
                logger.error(`❌ Failed to publish version event after updateMetadataWithRetry:`, error);
                // Event publish hatası işlemi engellemesin
            }
        }

        return result;
    }

    /**
    * Versiyon kilitli ATOMİK güncelleme — FOREIGN kopya yakınsaması için (issue #637)
    *
    * NEDEN VAR (canlıda kanıtlandı, 31/08/2026): FOREIGN kopya listener'ları
    * versiyonu "oku → karşılaştır → yaz" ile denetliyordu. NATS aynı varlığa ait
    * ardışık event'leri EŞZAMANLI teslim edebildiği için (base-listener'da
    * maxInFlight sınırı yok, onMessage await'siz) iki event de eski değeri okuyor,
    * ikisi de kontrolü geçiyor ve SON YAZAN kazanıyordu: depo sayımı sonrası
    * kaynakta 0 (v=19) olan grup ürünü, dört kopya serviste 15 (v=18) kaldı ve
    * pazaryerlerine OLMAYAN stok gitti.
    *
    * Bu metod kontrolü ve yazmayı TEK MongoDB belge işleminde birleştirir:
    *
    *     findOneAndUpdate({ _id, version: { $lt: N } }, { $set: {...) })
    *
    * MongoDB'nin tek-belge atomikliği altında ESKİ VERSİYON YENİYİ ASLA EZEMEZ —
    * teslim sırasından, kilitten ve tekrar sayısından bağımsız, yapısal garanti.
    *
    * SONUÇ SÖZLEŞMESİ (çağıranın ack kararı buna dayanır):
    *   - 'applied' → yazıldı; versiyon event'i yayınlandı → BAŞARI, ack
    *   - 'stale'   → kopya zaten daha yeni; no-op → BAŞARI, ack
    *                 (bayat event'i ack'lememek NATS'ta sonsuz yeniden teslim
    *                  birikimi yaratır — bayatlık TERMİNALDİR, hata değildir)
    *   - 'missing' → kayıt hiç yok → çağıran OLUŞTURMA yolunu dener
    *
    * NOT: soft-delete filtresi yalnız find/findOne'a enjekte edilir
    * (base.schema.ts:410-432), findOneAndUpdate'e DEĞİL — silinmiş kopyaya gelen
    * idempotent tekrar da doğru şekilde 'stale'/'applied' üretir.
    * RETRY YOK: işlem tek ve atomik; geçici Mongo hatası fırlar ve listener'ın
    * kendi retry/DLQ zinciri devralır.
    */
    static async applyVersionedUpdate<T = any>(
        Model: any,
        id: string,
        version: number,
        updateFields: Record<string, any>,
        operationName?: string
    ): Promise<{ outcome: 'applied' | 'stale' | 'missing'; doc: T | null }> {
        const docName = operationName || `${Model.modelName} ${id}`;

        /**
         * İKİ TUR ZORUNLU (kendi race testinde yakalandı, 31/08): CAS eşleşmeyip
         * exists kontrolüne geçtiğimiz ARADA eşzamanlı bir oluşturma commit
         * olabilir — exists=true'yu tek başına "bayat" saymak, az önce doğmuş
         * DÜŞÜK versiyonlu kaydı güncellemeden event'i no-op'a düşürür (TOCTOU).
         * exists=true görülünce CAS bir kez daha denenir; versiyonlar yalnız
         * YUKARI gittiği için ikinci eşleşmeme kesin bayatlıktır.
         */
        for (let attempt = 0; attempt < 2; attempt++) {
            // `version` alanı filtrede kilit, $set'te hedef — updateFields'tan
            // gelecek bir version bu sözleşmeyi sessizce bozar, burada ezilir.
            const doc = await Model.findOneAndUpdate(
                { _id: id, version: { $lt: version } },
                { $set: { ...updateFields, version, updatedOn: new Date() } },
                { new: true }
            );

            if (doc) {
                try {
                    // updateMetadataWithRetry ile AYNI yayın yolu: sync servisi
                    // (EntitySyncState/versionDiff) kopyanın ilerlediğini görmeli.
                    await this.publishVersionEventForUpdate(Model, doc, version);
                } catch (error) {
                    logger.error(`❌ Versiyon event'i yayınlanamadı (${docName}):`, error);
                    // Yayın hatası yazımı geri almaz; drift'i sync döngüsü yakalar
                }
                return { outcome: 'applied', doc };
            }

            // `includeDeleted: true` ŞART — soft-delete edilmiş kopya "yok"
            // sanılırsa çağıran oluşturmayı dener ve E11000'e çarpar.
            const exists = await Model.findOne({ _id: id, includeDeleted: true })
                .select('_id')
                .lean();

            if (!exists) {
                return { outcome: 'missing', doc: null };
            }
            // exists ama eşleşmedi → ikinci turda kesinleşir
        }

        return { outcome: 'stale', doc: null };
    }

    /**
    * Context-aware updateMetadataWithRetry: Request object'ten session algılama
    *
    * @static
    * @template T
    * @param {any} Model - Mongoose model
    * @param {string} id - Doküman ID'si
    * @param {any} updateFields - Güncellenecek metadata alanları
    * @param {Request} [req] - Express Request object (session algılamak için)
    * @param {any} [options={}] - MongoDB update seçenekleri
    * @param {string} [operationName] - İşlem adı (loglama için)
    * @return {Promise<T>} Güncellenen doküman
    * @description Request context'inden session'ı otomatik algılar ve metadata güncelleme yapar.
    */
    static async updateMetadataWithContext<T>(
        Model: any,
        id: string,
        updateFields: any,
        req?: Request,
        options: any = {},
        operationName?: string
    ): Promise<T> {
        const session = req && (req as any).dbSession ? (req as any).dbSession : undefined;
        return await this.updateMetadataWithRetry(Model, id, updateFields, options, operationName, session);
    }

    /**
    * Bulk operations with session support
    * 
    * @static
    * @template T
    * @param {any} Model - Mongoose model
    * @param {any[]} operations - Bulk operations array
    * @param {ClientSession} [session] - MongoDB session (transaction için)
    * @param {string} [operationName] - İşlem adı (loglama için)
    * @return {Promise<any>} Bulk operation result
    * @description Bulk operations for better performance with session support.
    */
    static async bulkWithRetry<T>(
        Model: any,
        operations: any[],
        session?: ClientSession,
        operationName?: string
    ): Promise<any> {
        const opName = operationName || `${Model.modelName} bulk operations`;
        
        return await this.retryWithOptimisticLocking(
            async () => {
                const bulkOptions = session ? { session } : {};
                const result = await Model.bulkWrite(operations, bulkOptions);
                return result;
            },
            5,
            100,
            `${opName}${session ? ' (transactional)' : ''}`
        );
    }

    /**
    * Context-aware bulk operations
    * 
    * @static
    * @template T
    * @param {any} Model - Mongoose model
    * @param {any[]} operations - Bulk operations array
    * @param {Request} [req] - Express Request object (session algılamak için)
    * @param {string} [operationName] - İşlem adı (loglama için)
    * @return {Promise<any>} Bulk operation result
    */
    static async bulkWithContext<T>(
        Model: any,
        operations: any[],
        req?: Request,
        operationName?: string
    ): Promise<any> {
        const session = req && (req as any).dbSession ? (req as any).dbSession : undefined;
        return await this.bulkWithRetry(Model, operations, session, operationName);
    }

    /**
    * Session detection utility
    * 
    * @static
    * @param {Request} [req] - Express Request object
    * @return {ClientSession | undefined} Detected session or undefined
    * @description Helper method to detect if a session is available in request context.
    */
    static getSessionFromRequest(req?: Request): ClientSession | undefined {
        return req && (req as any).dbSession ? (req as any).dbSession : undefined;
    }

    /**
    * Check if operation is running in transaction context
    * 
    * @static
    * @param {Request} [req] - Express Request object
    * @return {boolean} True if in transaction context
    */
    static isInTransaction(req?: Request): boolean {
        const session = this.getSessionFromRequest(req);
        return session ? session.inTransaction() : false;
    }

    /**
    * Get operation statistics
    * 
    * @static
    * @param {Request} [req] - Express Request object
    * @return {object} Statistics object
    */
    static getStats(req?: Request): {
        hasSession: boolean;
        inTransaction: boolean;
        sessionId: ClientSession['id'] | null;
        features: {
            sessionAware: boolean;
            contextAware: boolean;
            bulkOperations: boolean;
            optimisticLocking: boolean;
            transactionSupport: boolean;
        };
    } {
        const session = this.getSessionFromRequest(req);
        return {
            hasSession: !!session,
            inTransaction: session ? session.inTransaction() : false,
            sessionId: session ? session.id : null,
            features: {
                sessionAware: true,
                contextAware: true,
                bulkOperations: true,
                optimisticLocking: true,
                transactionSupport: true
            }
        };
    }
}