import type { ClientSession, Model } from 'mongoose';
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
