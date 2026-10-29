import type { Model } from 'mongoose';
import type { EmitReturnConfig } from '../models/base/base.schema';
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
export declare const ENTITY_DELETED_MAX_LIST = 100;
/** Boş (undefined/null) kayıtları ayıklayıp listeyi en çok `size` öğelik parçalara böler. */
export declare function chunkEntityDeletedList(list: Array<EmitReturnConfig | null | undefined>, size?: number): EmitReturnConfig[][];
/**
 * EntityDeleted olaylarını outbox'a yazar.
 * @returns yazılan outbox satırı (parça) sayısı; boş listede 0
 * @throws DatabaseConnectionError outbox yazımı başarısızsa
 */
export declare function writeEntityDeletedEventsToOutbox(Outbox: Model<any>, list: Array<EmitReturnConfig | null | undefined>, size?: number): Promise<number>;
