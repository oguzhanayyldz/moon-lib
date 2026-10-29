import { Stan } from 'node-nats-streaming';
import mongoose from 'mongoose';
import { RetryableListener } from '../retryableListener';
import { Subjects } from '../../common/events/subjects';
import { UserSessionsRevokedEvent } from '../../common/events/user-sessions-revoked-event';
import { createSessionRevocationModel } from '../../models/sessionRevocation.schema';
type ListenerRetryOptions = ConstructorParameters<typeof RetryableListener>[1];
/** Servisin tracer'indan kullanilan alt kume (jaeger `Span` ile uyumlu). */
export interface SessionRevokedSpan {
    setTag(key: string, value: unknown): unknown;
    finish(): void;
}
export interface SessionRevokedTracer {
    startSpan(name: string): SessionRevokedSpan;
}
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
export declare abstract class BaseUserSessionsRevokedListener extends RetryableListener<UserSessionsRevokedEvent> {
    subject: Subjects.UserSessionsRevoked;
    abstract readonly queueGroupName: string;
    /** Log oneki: `[<serviceName>] ...` */
    protected abstract readonly serviceName: string;
    protected abstract readonly tracer: SessionRevokedTracer;
    protected readonly sessionRevocationModel: ReturnType<typeof createSessionRevocationModel>;
    constructor(client: Stan, options?: ListenerRetryOptions, connection?: mongoose.Connection);
    /**
     * Kilit ve tekrar sayaci anahtari. Kullanici + damga basina tekil: ayni olayin tekrar
     * teslimi ayni anahtari alir, farkli kullanicilarin eszamanli olaylari kilit icin cekismez.
     */
    protected getEventId(data: UserSessionsRevokedEvent['data']): string;
    /** Damgayi izdusume yazar. Varsayilan: yalniz `SessionRevocation`. */
    protected applyRevocation(userId: string, revokedAt: Date, _span: SessionRevokedSpan): Promise<void>;
    protected processEvent(data: UserSessionsRevokedEvent['data']): Promise<void>;
}
export {};
//# sourceMappingURL=BaseUserSessionsRevokedListener.d.ts.map