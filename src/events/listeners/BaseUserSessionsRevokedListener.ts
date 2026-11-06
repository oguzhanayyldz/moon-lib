import { Stan } from 'node-nats-streaming';
import mongoose from 'mongoose';
import { RetryableListener } from '../retryableListener';
import { Subjects } from '../../common/events/subjects';
import { UserSessionsRevokedEvent } from '../../common/events/user-sessions-revoked-event';
import { logger } from '../../services/logger.service';
import { createSessionRevocationModel, normalizeSessionRevocationUserId } from '../../models/sessionRevocation.schema';

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
export abstract class BaseUserSessionsRevokedListener extends RetryableListener<UserSessionsRevokedEvent> {
    subject: Subjects.UserSessionsRevoked = Subjects.UserSessionsRevoked;

    abstract readonly queueGroupName: string;

    /** Log oneki: `[<serviceName>] ...` */
    protected abstract readonly serviceName: string;

    protected abstract readonly tracer: SessionRevokedTracer;

    protected readonly sessionRevocationModel: ReturnType<typeof createSessionRevocationModel>;

    constructor(client: Stan, options: ListenerRetryOptions = {}, connection: mongoose.Connection = mongoose.connection) {
        super(client, options, connection);
        this.sessionRevocationModel = createSessionRevocationModel(connection);
    }

    /**
     * Kilit ve tekrar sayaci anahtari. Kullanici + damga basina tekil: ayni olayin tekrar
     * teslimi ayni anahtari alir, farkli kullanicilarin eszamanli olaylari kilit icin cekismez.
     */
    protected getEventId(data: UserSessionsRevokedEvent['data']): string {
        return `user-sessions-revoked-${data.userId}-${data.revokedAt}`;
    }

    /** Damgayi izdusume yazar. Varsayilan: yalniz `SessionRevocation`. */
    protected async applyRevocation(userId: string, revokedAt: Date, _span: SessionRevokedSpan): Promise<void> {
        await this.sessionRevocationModel.updateOne(
            { userId: normalizeSessionRevocationUserId(userId) },
            { $max: { sessionsRevokedAt: revokedAt } },
            { upsert: true }
        );
        logger.info(`[${this.serviceName}] User ${userId} sessionsRevokedAt applied to SessionRevocation`);
    }

    protected async processEvent(data: UserSessionsRevokedEvent['data']): Promise<void> {
        const span = this.tracer.startSpan('user-sessions-revoked-listener');
        span.setTag('event.id', data.userId);

        try {
            const revokedAt = new Date(data.revokedAt);
            if (Number.isNaN(revokedAt.getTime())) {
                // Tekrar denemek duzeltmez: gecersiz yuk kalici.
                logger.error(`[${this.serviceName}] UserSessionsRevoked invalid revokedAt for user ${data.userId}`);
                span.setTag('skipped', true);
                span.setTag('skip.reason', 'invalid-revokedAt');
                return;
            }

            await this.applyRevocation(data.userId, revokedAt, span);

            span.setTag('success', true);
        } catch (error) {
            span.setTag('error', true);
            span.setTag('error.message', (error as Error).message);
            logger.error(`[${this.serviceName}] UserSessionsRevoked processing error:`, error);
            throw error;
        } finally {
            span.finish();
        }
    }
}
