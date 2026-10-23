"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
function writeVersionEventToOutbox(Outbox, payload, session) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const clean = withoutUndefined(payload);
        const environment = process.env.NODE_ENV || 'production';
        // Faz 1 (varsayılan): yazım tarafı birleştirmesi KAPALI, her güncelleme kendi satırını açar. Karışık deploy'da eski yayıncı
        // pod, claim'den önce okuduğu satırı published yapar; yeni yazıcı o satıra daha yeni sürümü birleştirmişse sürüm kaybolur.
        // Faz 2: tüm pod'lar yeni koddayken VERSION_EVENT_WRITE_COALESCE=true ile açılır (gönderim tarafı birleştirme her zaman açık).
        const coalesceOnWrite = ['1', 'true'].includes(String(process.env.VERSION_EVENT_WRITE_COALESCE).toLowerCase());
        const merged = !coalesceOnWrite ? null : yield Outbox.findOneAndUpdate({
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
            yield Outbox.create([doc], { session });
        }
        else {
            yield Outbox.create(doc);
        }
        return 'created';
    });
}
