"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.versionEventKey = versionEventKey;
exports.writeVersionEventToOutbox = writeVersionEventToOutbox;
const subjects_1 = require("../common/events/subjects");
const EventMetrics_1 = require("../metrics/EventMetrics");
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
/** EventPublisherJob.MAX_PUBLISH_ATTEMPTS ile aynı: hakkı bitmiş pending satır yayınlanmaz, ona birleştirilmez. */
const MAX_PUBLISH_ATTEMPTS = 5;
/** Aynı varlığın sürüm olaylarını gruplayan anahtar (yazımda ve gönderimde aynı). */
function versionEventKey(payload) {
    var _a;
    const p = payload !== null && payload !== void 0 ? payload : {};
    return [p.entityType, p.entityId, p.service, (_a = p.userId) !== null && _a !== void 0 ? _a : ''].join('|');
}
/** undefined alanlar pipeline güncellemesine null olarak girmesin (create yolundaki mongoose davranışıyla aynı) */
function withoutUndefined(value) {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));
}
/**
 * Sürüm olayını outbox'a yazar ya da bekleyen satırla birleştirir.
 * @returns 'coalesced' mevcut pending satır güncellendi · 'created' yeni satır açıldı
 */
async function writeVersionEventToOutbox(Outbox, payload, session) {
    var _a;
    const clean = withoutUndefined(payload);
    const environment = process.env.NODE_ENV || 'production';
    const merged = await Outbox.findOneAndUpdate({
        eventType: subjects_1.Subjects.EntityVersionUpdated,
        status: 'pending',
        environment,
        retryCount: { $lt: MAX_PUBLISH_ATTEMPTS },
        'payload.entityType': payload.entityType,
        'payload.entityId': payload.entityId,
        'payload.service': payload.service,
        'payload.userId': (_a = payload.userId) !== null && _a !== void 0 ? _a : null
    }, [
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
    ], Object.assign({ new: false, projection: { _id: 1 }, lean: true }, (session ? { session } : {})));
    if (merged) {
        EventMetrics_1.EventMetrics.versionEventsCoalescedTotal.inc({ service: payload.service, stage: 'write' });
        return 'coalesced';
    }
    const doc = { eventType: subjects_1.Subjects.EntityVersionUpdated, payload: clean, status: 'pending' };
    if (session) {
        await Outbox.create([doc], { session });
    }
    else {
        await Outbox.create(doc);
    }
    return 'created';
}
//# sourceMappingURL=versionEventOutbox.util.js.map