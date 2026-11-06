import type { Model } from 'mongoose';
import { Subjects } from '../common/events/subjects';
import { DatabaseConnectionError } from '../common/errors/database-connection-error';
import { logger } from '../services/logger.service';
import type { EmitReturnConfig } from '../models/base/base.schema';
import { OptimisticLockingUtil } from './optimisticLocking.util';

/**
 * EntityDeleted outbox yazımı — UC-831 (F-06, F-07).
 *
 * - Liste ENTITY_DELETED_MAX_LIST'lik parçalara bölünür, her parça ayrı outbox satırıdır (tüketicide büyük liste
 *   ack süresini aşmasın).
 * - Yazım hatası YUTULMAZ, DatabaseConnectionError (500) olarak fırlatılır: rota 5xx dönmeli ki istemci yeniden
 *   çağırsın (errorHandler tanımadığı hatayı 400'e çevirir). Servislerdeki eski EventService.createEntityDeletedEvent
 *   kopyaları hatayı `false` dönüşüne çevirip 200 döndürüyordu.
 * - Parçalardan biri düşerse öncekiler yazılmış kalır; yeniden çağrı aynı listeyi yeniden yazar (tüketici silmesi
 *   idempotent, yinelenen olay zararsızdır).
 */

export const ENTITY_DELETED_MAX_LIST = 100;

/** Boş (undefined/null) kayıtları ayıklayıp listeyi en çok `size` öğelik parçalara böler. */
export function chunkEntityDeletedList(
    list: Array<EmitReturnConfig | null | undefined>,
    size: number = ENTITY_DELETED_MAX_LIST
): EmitReturnConfig[][] {
    if (!Number.isInteger(size) || size < 1) {
        throw new Error(`Invalid EntityDeleted chunk size: ${size}`);
    }
    const items = list.filter((item): item is EmitReturnConfig => !!item);
    const chunks: EmitReturnConfig[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

/**
 * EntityDeleted olaylarını outbox'a yazar.
 * @returns yazılan outbox satırı (parça) sayısı; boş listede 0
 * @throws DatabaseConnectionError outbox yazımı başarısızsa
 */
export async function writeEntityDeletedEventsToOutbox(
    Outbox: Model<any>,
    list: Array<EmitReturnConfig | null | undefined>,
    size: number = ENTITY_DELETED_MAX_LIST
): Promise<number> {
    const chunks = chunkEntityDeletedList(list, size);
    for (const chunk of chunks) {
        const outbox = (Outbox as any).build({
            eventType: Subjects.EntityDeleted,
            payload: {
                entity: chunk[0].entity,
                list: chunk
            },
            status: 'pending'
        });
        try {
            await OptimisticLockingUtil.saveWithRetry(outbox);
        } catch (error) {
            logger.error('EntityDeleted outbox write failed', {
                entity: chunk[0].entity,
                count: chunk.length,
                error: error instanceof Error ? error.message : String(error)
            });
            throw new DatabaseConnectionError();
        }
    }
    return chunks.length;
}
