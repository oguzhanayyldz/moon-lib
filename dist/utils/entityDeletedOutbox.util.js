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
exports.ENTITY_DELETED_MAX_LIST = void 0;
exports.chunkEntityDeletedList = chunkEntityDeletedList;
exports.writeEntityDeletedEventsToOutbox = writeEntityDeletedEventsToOutbox;
const subjects_1 = require("../common/events/subjects");
const database_connection_error_1 = require("../common/errors/database-connection-error");
const logger_service_1 = require("../services/logger.service");
const optimisticLocking_util_1 = require("./optimisticLocking.util");
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
exports.ENTITY_DELETED_MAX_LIST = 100;
/** Boş (undefined/null) kayıtları ayıklayıp listeyi en çok `size` öğelik parçalara böler. */
function chunkEntityDeletedList(list, size = exports.ENTITY_DELETED_MAX_LIST) {
    if (!Number.isInteger(size) || size < 1) {
        throw new Error(`Invalid EntityDeleted chunk size: ${size}`);
    }
    const items = list.filter((item) => !!item);
    const chunks = [];
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
function writeEntityDeletedEventsToOutbox(Outbox_1, list_1) {
    return __awaiter(this, arguments, void 0, function* (Outbox, list, size = exports.ENTITY_DELETED_MAX_LIST) {
        const chunks = chunkEntityDeletedList(list, size);
        for (const chunk of chunks) {
            const outbox = Outbox.build({
                eventType: subjects_1.Subjects.EntityDeleted,
                payload: {
                    entity: chunk[0].entity,
                    list: chunk
                },
                status: 'pending'
            });
            try {
                yield optimisticLocking_util_1.OptimisticLockingUtil.saveWithRetry(outbox);
            }
            catch (error) {
                logger_service_1.logger.error('EntityDeleted outbox write failed', {
                    entity: chunk[0].entity,
                    count: chunk.length,
                    error: error instanceof Error ? error.message : String(error)
                });
                throw new database_connection_error_1.DatabaseConnectionError();
            }
        }
        return chunks.length;
    });
}
