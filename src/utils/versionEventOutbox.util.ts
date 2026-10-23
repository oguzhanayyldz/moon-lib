import type { ClientSession, Model } from 'mongoose';
import { Subjects } from '../common/events/subjects';
import { EventMetrics } from '../metrics/EventMetrics';

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
export function versionEventKey(payload: Partial<VersionEventPayload> | undefined): string {
    const p = payload ?? {};
    return [p.entityType, p.entityId, p.service, p.userId ?? ''].join('|');
}

/** undefined alanlar pipeline güncellemesine null olarak girmesin (create yolundaki mongoose davranışıyla aynı) */
function withoutUndefined<T extends Record<string, unknown>>(value: T): T {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

/**
 * Sürüm olayını outbox'a yazar ya da bekleyen satırla birleştirir.
 * @returns 'coalesced' mevcut pending satır güncellendi · 'created' yeni satır açıldı
 */
export async function writeVersionEventToOutbox(
    Outbox: Model<any>,
    payload: VersionEventPayload,
    session?: ClientSession
): Promise<'coalesced' | 'created'> {
    const clean = withoutUndefined(payload);
    const environment = process.env.NODE_ENV || 'production';

    // Faz 1 (varsayılan): yazım tarafı birleştirmesi KAPALI, her güncelleme kendi satırını açar. Karışık deploy'da eski yayıncı
    // pod, claim'den önce okuduğu satırı published yapar; yeni yazıcı o satıra daha yeni sürümü birleştirmişse sürüm kaybolur.
    // Faz 2: tüm pod'lar yeni koddayken VERSION_EVENT_WRITE_COALESCE=true ile açılır (gönderim tarafı birleştirme her zaman açık).
    const coalesceOnWrite = ['1', 'true'].includes(String(process.env.VERSION_EVENT_WRITE_COALESCE).toLowerCase());
    const merged = !coalesceOnWrite ? null : await Outbox.findOneAndUpdate(
        {
            eventType: Subjects.EntityVersionUpdated,
            status: 'pending',
            environment,
            // Deneme hakkı devri yok: hakkı tükenmeye yakın satıra binen en yeni sürüm tek NATS hatasıyla kalıcı failed olmasın
            retryCount: 0,
            'payload.entityType': payload.entityType,
            'payload.entityId': payload.entityId,
            'payload.service': payload.service,
            'payload.userId': payload.userId ?? null
        },
        [
            {
                $set: {
                    payload: {
                        $cond: [
                            { $gt: [payload.version, { $ifNull: ['$payload.version', -1] }] },
                            { $literal: clean },
                            '$payload'
                        ]
                    },
                    coalescedCount: { $add: [{ $ifNull: ['$coalescedCount', 0] }, 1] }
                }
            }
        ],
        { new: false, projection: { _id: 1 }, lean: true, ...(session ? { session } : {}) }
    );

    if (merged) {
        EventMetrics.versionEventsCoalescedTotal.inc({ service: payload.service, stage: 'write' });
        return 'coalesced';
    }

    const doc = { eventType: Subjects.EntityVersionUpdated, payload: clean, status: 'pending' };
    if (session) {
        await Outbox.create([doc], { session });
    } else {
        await Outbox.create(doc);
    }
    return 'created';
}
