import mongoose from 'mongoose';
import { OperationType } from '../enums/operation-type.enum';
export interface AuthFailureTrackerContext {
    userId: string;
    integrationId: string;
    integrationName: string;
    /** Tek operasyonun auth-failure esigi. Varsayilan: 5 */
    threshold?: number;
    /**
     * Akilli pasiflestirme esigi (issue #566): Entegrasyonu pasife cekmek icin
     * KAC FARKLI operasyon turunun kendi auth esigini asmasi gerektigi. Varsayilan: 2
     */
    deactivationOperationThreshold?: number;
}
/**
 * Entegrasyon API client'larinda ardisik 401/403 auth hatalarini OPERASYON BAZINDA takip eder
 * (issue #521 + operation-aware #566).
 *
 * Tek bir bozuk operasyon (orn. FETCH_INVOICES) artik tum entegrasyonu pasife cekmez:
 *  - Her operasyon turunun kendi sayaci vardir; esik asilinca o operasyon "fail eden operasyonlar"
 *    SET'ine eklenir ve ilgili operasyonun devresi (CircuitBreaker) acilir.
 *  - Entegrasyon SADECE birden fazla farkli operasyon turu (>= deactivationOperationThreshold)
 *    kendi esigini astiginda — yani gercek bir credential-geneli sorun varsa — pasife cekilir.
 *  - Basarili bir cagri yalnizca KENDI operasyonunun sayacini sifirlar.
 *
 * Redis key'leri (TTL 24 saat):
 *  - Operasyon sayaci: integration:auth-failures:{userId}:{integrationId}:{operationType}
 *  - Fail eden operasyonlar SET'i: integration:auth-failed-ops:{userId}:{integrationId}
 */
export declare class AuthFailureTracker {
    private static readonly DEFAULT_THRESHOLD;
    private static readonly DEFAULT_DEACTIVATION_OP_THRESHOLD;
    private static readonly TTL_SECONDS;
    private static connection?;
    /**
     * Servis startup'inda cagrilir — Outbox event publish'i icin mongoose connection'i inject eder.
     * moon-lib pattern (retryableListener, eventPublisherJob) ile tutarli: explicit connection injection.
     */
    static initialize(connection: mongoose.Connection): void;
    /**
     * Operasyon bazli sayac key'i. operationType verilmezse OTHER bucket'ina dusler (geriye uyumlu).
     */
    static getKey(userId: string, integrationId: string, operationType?: OperationType | string): string;
    /**
     * Esigini asan farkli operasyon turlerini tutan SET key'i (akilli pasiflestirme karari icin).
     */
    static getFailedOpsKey(userId: string, integrationId: string): string;
    /**
     * 401/403 aldiginda ILGILI OPERASYONUN counter'ini artir.
     * Operasyon kendi esigini asarsa fail-eden-operasyonlar SET'ine eklenir; SET boyutu
     * deactivationOperationThreshold'a ulasirsa (gercek credential sorunu) event publish edilir.
     * @returns Guncel operasyon counter degeri (Redis hatasi durumunda 0)
     */
    static increment(context: AuthFailureTrackerContext, lastErrorStatus: 401 | 403, lastErrorMessage?: string, operationType?: OperationType | string): Promise<number>;
    /**
     * Bir operasyon kendi esigini astiginda cagrilir.
     * Operasyonu fail-eden-operasyonlar SET'ine ekler ve SET boyutuna gore
     * entegrasyonu pasife cekip cekmeyecegine karar verir.
     */
    private static evaluateDeactivation;
    /**
     * Basarili bir API call sonrasi counter'i sifirla.
     *  - operationType verilirse: YALNIZCA o operasyonun sayacini sifirlar ve SET'ten cikarir.
     *  - operationType verilmezse: TUM operasyon sayaclarini + fail-eden-operasyonlar SET'ini temizler
     *    (entegrasyon pasiflestirme/reaktivasyon sirasinda temiz baslangic icin).
     */
    static reset(userId: string, integrationId: string, operationType?: OperationType | string): Promise<void>;
    /**
     * Mevcut counter degerini oku (debug/UI icin).
     *  - operationType verilirse: o operasyonun sayaci.
     *  - verilmezse: fail-eden tum operasyonlarin sayaclari toplami (best-effort aggregate).
     */
    static get(userId: string, integrationId: string, operationType?: OperationType | string): Promise<number>;
    /**
     * Threshold asildiginda IntegrationAuthFailureExceeded event'ini Outbox'a yaz.
     * AuthFailureTracker.initialize(connection) servis startup'inda cagrilmamissa
     * uyari log'lar ama exception fırlatmaz (API isteklerini kirmaz).
     */
    private static publishExceededEvent;
}
//# sourceMappingURL=authFailureTracker.util.d.ts.map