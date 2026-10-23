import mongoose from "mongoose";
import { ResourceName } from '../common';
import { OperationType } from '../enums/operation-type.enum';
import { BaseAttrs, BaseDoc, BaseModel, createBaseSchema } from "./base/base.schema";
import type { ResponseSummary } from '../utils/integrationRequestLogPolicy.util';

/**
 * Yorumlanmış/özetlenmiş yanıt yapısı
 */
export interface InterpretedResponse {
    summary: string;              // İşlem özeti (örn: "15 ürün başarıyla gönderildi, 2 ürün başarısız")
    success: boolean;             // Genel başarı durumu
    successCount?: number;        // Başarılı işlem sayısı
    failureCount?: number;        // Başarısız işlem sayısı
    details?: Record<string, any>; // Ek detaylar (platform-specific)
    parsedAt: Date;               // Parse edilme zamanı
}

export interface IntegrationRequestLogAttrs extends BaseAttrs {
    integrationName: ResourceName;
    userId: string;
    operationType?: OperationType; // İşlem kategorisi (nullable - eski kayıtlar için)
    method: string;
    endpoint: string;
    requestHeaders?: Record<string, any>;
    requestBody?: Record<string, any>;
    responseStatus?: number;
    responseHeaders?: Record<string, any>;
    responseBody?: Record<string, any>;
    interpretedResponse?: InterpretedResponse; // Yorumlanmış yanıt
    errorMessage?: string;
    duration?: number; // milliseconds
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

export interface IntegrationRequestLogModel extends BaseModel<IntegrationRequestLogDoc, IntegrationRequestLogAttrs> { }

/**
 * İstek loglarının üst saklama süresi, `requestTime` TTL indeksiyle (UC-962'de 7 gün).
 * UC-979 Faz 2: asıl süre `expireAt` (başarı 3 / hata 14 gün); bu TTL en uzun süreye (14 gün) çekilir ve
 * yalnız yanıtı hiç yazılmamış kayıtlar için ağ olarak kalır. Ön koşul: tüm entegrasyon DB'lerinde
 * expireAt'siz belge kalmamış olmalı (Faz 1 ≥7 gün canlıda).
 */
export const INTEGRATION_REQUEST_LOG_TTL_SECONDS = 14 * 24 * 60 * 60;

const integrationRequestLogSchemaDefinition = {
    integrationName: {
        type: String,
        required: true,
        enum: Object.values(ResourceName)
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    operationType: {
        type: String,
        required: false, // Eski kayıtlar için nullable
        enum: Object.values(OperationType),
        index: true
    },
    method: {
        type: String,
        required: true,
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
    },
    endpoint: {
        type: String,
        required: true
    },
    requestHeaders: {
        type: mongoose.Schema.Types.Mixed
    },
    requestBody: {
        type: mongoose.Schema.Types.Mixed
    },
    responseStatus: {
        type: Number
    },
    responseHeaders: {
        type: mongoose.Schema.Types.Mixed
    },
    responseBody: {
        type: mongoose.Schema.Types.Mixed
    },
    interpretedResponse: {
        type: {
            summary: { type: String, required: true },
            success: { type: Boolean, required: true },
            successCount: { type: Number, required: false },
            failureCount: { type: Number, required: false },
            details: { type: mongoose.Schema.Types.Mixed, required: false },
            parsedAt: { type: Date, required: true }
        },
        required: false
    },
    errorMessage: {
        type: String
    },
    duration: {
        type: Number
    },
    requestTime: {
        type: Date,
        required: true,
        // TTL (UC-962, UC-979 Faz 2): Mongo kayıtları requestTime'dan 14 gün sonra kendisi siler.
        // Mevcut veritabanlarında indeks TTL'siz kurulu; ensureIntegrationRequestLogTtlIndex collMod ile dönüştürür.
        index: { expires: INTEGRATION_REQUEST_LOG_TTL_SECONDS }
    },
    responseTime: {
        type: Date
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed
    },
    expireAt: {
        type: Date
    },
    responseSummary: {
        type: mongoose.Schema.Types.Mixed
    },
    searchKeys: {
        type: [String],
        default: undefined
    },
    requestBytes: {
        type: Number
    },
    responseBytes: {
        type: Number
    },
    idempotentSuccess: {
        type: Boolean
    }
};

const integrationRequestLogSchema = createBaseSchema(integrationRequestLogSchemaDefinition);

// Virtual field: success - Computed from responseStatus
integrationRequestLogSchema.virtual('success').get(function(this: IntegrationRequestLogDoc) {
    if (!this.responseStatus) return false;
    return this.responseStatus >= 200 && this.responseStatus < 300;
});

// Enable virtuals in JSON and object output
integrationRequestLogSchema.set('toJSON', { virtuals: true });
integrationRequestLogSchema.set('toObject', { virtuals: true });

// Compound index for efficient queries
integrationRequestLogSchema.index({ integrationName: 1, userId: 1, requestTime: -1 });
integrationRequestLogSchema.index({ userId: 1, requestTime: -1 });
integrationRequestLogSchema.index({ integrationName: 1, requestTime: -1 });
// OperationType için yeni index'ler
integrationRequestLogSchema.index({ operationType: 1, userId: 1, requestTime: -1 });
integrationRequestLogSchema.index({ operationType: 1, integrationName: 1, requestTime: -1 });
// UC-979: sonuca göre saklama süresi — belge expireAt anında silinir. expireAt'siz (eski) belgelere
// dokunmaz; onları requestTime TTL'i (güvenlik ağı) siler.
integrationRequestLogSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
// UC-979: gelişmiş arama kimlik listesinde tam eşleşme (gövde regex'i yerine)
integrationRequestLogSchema.index({ searchKeys: 1, requestTime: -1 });

export function createIntegrationRequestLogModel(connection: mongoose.Connection): void {
    connection.model<IntegrationRequestLogDoc, IntegrationRequestLogModel>('IntegrationRequestLog', integrationRequestLogSchema);
}

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
export async function ensureIntegrationRequestLogTtlIndex(
    connection: mongoose.Connection,
    expireAfterSeconds: number = INTEGRATION_REQUEST_LOG_TTL_SECONDS
): Promise<RequestLogTtlIndexResult> {
    const collection = connection.model('IntegrationRequestLog').collection;

    let indexes: Array<{ name?: string; key: Record<string, unknown>; expireAfterSeconds?: number }> = [];
    try {
        indexes = (await collection.indexes()) as typeof indexes;
    } catch (error: any) {
        // Koleksiyon henüz yok (ilk kurulum): NamespaceNotFound
        if (error?.code !== 26) throw error;
    }

    const existing = indexes.find(index => {
        const keys = Object.keys(index.key);
        return keys.length === 1 && keys[0] === 'requestTime' && index.key.requestTime === 1;
    });

    if (existing) {
        if (existing.expireAfterSeconds === expireAfterSeconds) return 'unchanged';
        await connection.db.command({
            collMod: collection.collectionName,
            index: { keyPattern: { requestTime: 1 }, expireAfterSeconds }
        });
        return 'modified';
    }

    await collection.createIndex({ requestTime: 1 }, { expireAfterSeconds });
    return 'created';
}
