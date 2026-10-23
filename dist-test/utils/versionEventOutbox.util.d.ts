import type { ClientSession, Model } from 'mongoose';
/**
 * EntityVersionUpdated outbox yazımı — birleştirme (coalescing), UC-984 madde 8.
 *
 * sync ara sürümleri kullanmaz (eski ya da eşit sürüm 'stale' sayılır); yalnız en son sürüm anlamlıdır.
 * Aynı (entityType, entityId, service, userId) için yayın bekleyen (pending) bir satır varsa yeni satır açılmaz:
 * o satır ATOMİK olarak güncellenir ve payload yalnız gelen sürüm daha büyükse değişir (eski sürüm yeniyi ezmez).
 * Yalnız `entity:version-updated` birleştirilir; diğer olay tipleri bu yoldan geçmez.
 *
 * Eşzamanlılık:
 *  - Güncelleme filtresi `status: 'pending'` içerir. Yayıncının claim'i (pending → processing) ile yarışta ya
 *    güncelleme claim'den önce uygulanır (yayıncı claim SONRASI okuduğu güncel satırı gönderir) ya da filtre
 *    tutmaz ve yeni pending satır açılır. Gönderimi süren satıra dokunulmaz.
 *  - İki pod aynı anda eşleşme bulamazsa iki pending satır açılabilir; tekil indeks bilinçli olarak YOK:
 *    monitorFailedEvents'in processing/failed → pending geri alımı tekil indekse çarpıp kurtarmayı durdururdu.
 *    Aynı varlığın birden fazla satırı gönderimde toplanır (EventPublisherJob: yalnız en yüksek sürüm gider,
 *    diğerleri 'superseded'). Eski pod'ların her güncellemede açtığı satırlar da aynı yoldan toplanır.
 */
export interface VersionEventPayload {
    entityType: string;
    entityId: string;
    service: string;
    version: number;
    userId?: string;
    [key: string]: unknown;
}
/** Aynı varlığın sürüm olaylarını gruplayan anahtar (yazımda ve gönderimde aynı). */
export declare function versionEventKey(payload: Partial<VersionEventPayload> | undefined): string;
/**
 * Sürüm olayını outbox'a yazar ya da bekleyen satırla birleştirir.
 * @returns 'coalesced' mevcut pending satır güncellendi · 'created' yeni satır açıldı
 */
export declare function writeVersionEventToOutbox(Outbox: Model<any>, payload: VersionEventPayload, session?: ClientSession): Promise<'coalesced' | 'created'>;
//# sourceMappingURL=versionEventOutbox.util.d.ts.map