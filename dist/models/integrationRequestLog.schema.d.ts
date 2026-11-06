import mongoose from "mongoose";
import { ResourceName } from '../common';
import { OperationType } from '../enums/operation-type.enum';
import { BaseAttrs, BaseDoc, BaseModel } from "./base/base.schema";
import type { ResponseSummary } from '../utils/integrationRequestLogPolicy.util';
/**
 * Yorumlanmış/özetlenmiş yanıt yapısı
 */
export interface InterpretedResponse {
    summary: string;
    success: boolean;
    successCount?: number;
    failureCount?: number;
    details?: Record<string, any>;
    parsedAt: Date;
}
export interface IntegrationRequestLogAttrs extends BaseAttrs {
    integrationName: ResourceName;
    userId: string;
    operationType?: OperationType;
    method: string;
    endpoint: string;
    requestHeaders?: Record<string, any>;
    requestBody?: Record<string, any>;
    responseStatus?: number;
    responseHeaders?: Record<string, any>;
    responseBody?: Record<string, any>;
    interpretedResponse?: InterpretedResponse;
    errorMessage?: string;
    duration?: number;
    requestTime: Date;
    responseTime?: Date;
    metadata?: Record<string, any>;
    /** UC-979: silinme anı (başarı +3 gün, hata +14 gün) — expireAfterSeconds:0 TTL. */
    expireAt?: Date;
    /** UC-979: başarılı okumada gövde yerine saklanan özet. */
    responseSummary?: ResponseSummary;
    /** UC-979: gelişmiş arama kimlikleri (sipariş no, paket id, barkod...). */
    searchKeys?: string[];
    /** UC-979: kırpma öncesi UTF-8 bayt boyu. */
    requestBytes?: number;
    responseBytes?: number;
    /** UC-979: 409 + gövde success:true (aynı işlem önceden yapılmış) — listede gövde olmadan gösterilir. */
    idempotentSuccess?: boolean;
}
export interface IntegrationRequestLogDoc extends BaseDoc {
    integrationName: ResourceName;
    userId: string;
    operationType?: OperationType;
    method: string;
    endpoint: string;
    requestHeaders?: Record<string, any>;
    requestBody?: Record<string, any>;
    responseStatus?: number;
    responseHeaders?: Record<string, any>;
    responseBody?: Record<string, any>;
    interpretedResponse?: InterpretedResponse;
    errorMessage?: string;
    duration?: number;
    requestTime: Date;
    responseTime?: Date;
    metadata?: Record<string, any>;
    /** UC-979: silinme anı (başarı +3 gün, hata +14 gün) — expireAfterSeconds:0 TTL. */
    expireAt?: Date;
    /** UC-979: başarılı okumada gövde yerine saklanan özet. */
    responseSummary?: ResponseSummary;
    /** UC-979: gelişmiş arama kimlikleri (sipariş no, paket id, barkod...). */
    searchKeys?: string[];
    /** UC-979: kırpma öncesi UTF-8 bayt boyu. */
    requestBytes?: number;
    responseBytes?: number;
    /** UC-979: 409 + gövde success:true (aynı işlem önceden yapılmış) — listede gövde olmadan gösterilir. */
    idempotentSuccess?: boolean;
}
export interface IntegrationRequestLogModel extends BaseModel<IntegrationRequestLogDoc, IntegrationRequestLogAttrs> {
}
/**
 * İstek loglarının üst saklama süresi, `requestTime` TTL indeksiyle (UC-962'de 7 gün).
 * UC-979 Faz 2: asıl süre `expireAt` (başarı 3 / hata 14 gün); bu TTL en uzun süreye (14 gün) çekilir ve
 * yalnız yanıtı hiç yazılmamış kayıtlar için ağ olarak kalır. Ön koşul: tüm entegrasyon DB'lerinde
 * expireAt'siz belge kalmamış olmalı (Faz 1 ≥7 gün canlıda).
 */
export declare const INTEGRATION_REQUEST_LOG_TTL_SECONDS: number;
export declare function createIntegrationRequestLogModel(connection: mongoose.Connection): void;
export type RequestLogTtlIndexResult = 'unchanged' | 'modified' | 'created';
/**
 * `requestTime_1` indeksini TTL'li hale getirir (UC-962) — idempotent, her servis başlangıcında çalışır.
 *
 * Neden collMod: aynı anahtarla ikinci bir indeks açılamaz (IndexOptionsConflict) ve eski indeksi
 * düşürüp yeniden kurmak 47 GB'lık koleksiyonda tam tarama demektir. collMod yalnız indeks
 * kataloğunu günceller (Mongo ≥5.1; canlı 7.0.4).
 *
 * - İndeks TTL'li ve süre aynı → dokunmaz.
 * - İndeks var, TTL yok ya da süre farklı → collMod.
 * - Koleksiyon / indeks yok → TTL'li olarak oluşturur (şemanın autoIndex'i de aynısını yapar; eşdeğer, çakışmaz).
 *
 * Not: Bu sürümden önceki şema (`index: true`) TTL'li indekse karşı autoIndex'te IndexOptionsConflict alır;
 * mongoose bunu sessizce yutar (servis açılır, diğer indeksler kurulur) — geri dönüşte TTL yerinde kalır.
 */
export declare function ensureIntegrationRequestLogTtlIndex(connection: mongoose.Connection, expireAfterSeconds?: number): Promise<RequestLogTtlIndexResult>;
