"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.versionEventKey = versionEventKey;
exports.writeVersionEventToOutbox = writeVersionEventToOutbox;
const subjects_1 = require("../common/events/subjects");
const EventMetrics_1 = require("../metrics/EventMetrics");
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
    // Faz 1 (varsayılan): yazım tarafı birleştirmesi KAPALI, her güncelleme kendi satırını açar. Karışık deploy'da eski yayıncı
    // pod, claim'den önce okuduğu satırı published yapar; yeni yazıcı o satıra daha yeni sürümü birleştirmişse sürüm kaybolur.
    // Faz 2: tüm pod'lar yeni koddayken VERSION_EVENT_WRITE_COALESCE=true ile açılır (gönderim tarafı birleştirme her zaman açık).
    const coalesceOnWrite = ['1', 'true'].includes(String(process.env.VERSION_EVENT_WRITE_COALESCE).toLowerCase());
    const merged = !coalesceOnWrite ? null : await Outbox.findOneAndUpdate({
        eventType: subjects_1.Subjects.EntityVersionUpdated,
        status: 'pending',
        environment,
        // Deneme hakkı devri yok: hakkı tükenmeye yakın satıra binen en yeni sürüm tek NATS hatasıyla kalıcı failed olmasın
        retryCount: 0,
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