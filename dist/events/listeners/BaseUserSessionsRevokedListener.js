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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseUserSessionsRevokedListener = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const retryableListener_1 = require("../retryableListener");
const subjects_1 = require("../../common/events/subjects");
const logger_service_1 = require("../../services/logger.service");
const sessionRevocation_schema_1 = require("../../models/sessionRevocation.schema");
/**
 * UserSessionsRevoked ortak dinleyicisi (UC-923; UC-921/UC-922 servis kopyalarinin tek hali).
 *
 * - Auth'un oturum iptal damgasini `SessionRevocation` izdusumune yazar; yazma uclarindaki
 *   `requireFreshSessionOnWrites` yalniz buradan okur.
 * - `$max` + upsert: damga yalniz ileri gider; sirasiz ya da tekrarli teslim eski degeri
 *   geri yazamaz. `version` kontrolu YOK — auth damgada `version` artirmiyor (olay tipi notu).
 * - Gecersiz `revokedAt` kalici: tekrar denemek duzeltmez, loglanip ack'lenir.
 *
 * Alt sinif yalniz `queueGroupName`, `serviceName` (log oneki) ve `tracer` verir. FOREIGN User
 * kopyasina da yazan servis (integration, subscription) `applyRevocation`'i ezer.
 */
class BaseUserSessionsRevokedListener extends retryableListener_1.RetryableListener {
    constructor(client, options = {}, connection = mongoose_1.default.connection) {
        super(client, options, connection);
        this.subject = subjects_1.Subjects.UserSessionsRevoked;
        this.sessionRevocationModel = (0, sessionRevocation_schema_1.createSessionRevocationModel)(connection);
    }
    /**
     * Kilit ve tekrar sayaci anahtari. Kullanici + damga basina tekil: ayni olayin tekrar
     * teslimi ayni anahtari alir, farkli kullanicilarin eszamanli olaylari kilit icin cekismez.
     */
    getEventId(data) {
        return `user-sessions-revoked-${data.userId}-${data.revokedAt}`;
    }
    /** Damgayi izdusume yazar. Varsayilan: yalniz `SessionRevocation`. */
    applyRevocation(userId, revokedAt, _span) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.sessionRevocationModel.updateOne({ userId: (0, sessionRevocation_schema_1.normalizeSessionRevocationUserId)(userId) }, { $max: { sessionsRevokedAt: revokedAt } }, { upsert: true });
            logger_service_1.logger.info(`[${this.serviceName}] User ${userId} sessionsRevokedAt applied to SessionRevocation`);
        });
    }
    processEvent(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const span = this.tracer.startSpan('user-sessions-revoked-listener');
            span.setTag('event.id', data.userId);
            try {
                const revokedAt = new Date(data.revokedAt);
                if (Number.isNaN(revokedAt.getTime())) {
                    // Tekrar denemek duzeltmez: gecersiz yuk kalici.
                    logger_service_1.logger.error(`[${this.serviceName}] UserSessionsRevoked invalid revokedAt for user ${data.userId}`);
                    span.setTag('skipped', true);
                    span.setTag('skip.reason', 'invalid-revokedAt');
                    return;
                }
                yield this.applyRevocation(data.userId, revokedAt, span);
                span.setTag('success', true);
            }
            catch (error) {
                span.setTag('error', true);
                span.setTag('error.message', error.message);
                logger_service_1.logger.error(`[${this.serviceName}] UserSessionsRevoked processing error:`, error);
                throw error;
            }
            finally {
                span.finish();
            }
        });
    }
}
exports.BaseUserSessionsRevokedListener = BaseUserSessionsRevokedListener;
