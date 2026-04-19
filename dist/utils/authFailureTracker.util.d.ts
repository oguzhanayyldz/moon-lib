import mongoose from 'mongoose';
export interface AuthFailureTrackerContext {
    userId: string;
    integrationId: string;
    integrationName: string;
    threshold?: number;
}
/**
 * Entegrasyon API client'larinda ardisik 401/403 auth hatalarini takip eder.
 * Threshold asildiginda IntegrationAuthFailureExceededEvent publish edilir (Outbox).
 * Basarili bir cagri sayaci sifirlar.
 *
 * Redis key: integration:auth-failures:{userId}:{integrationId} (TTL 24 saat)
 */
export declare class AuthFailureTracker {
    private static readonly DEFAULT_THRESHOLD;
    private static readonly TTL_SECONDS;
    private static connection?;
    /**
     * Servis startup'inda cagrilir — Outbox event publish'i icin mongoose connection'i inject eder.
     * moon-lib pattern (retryableListener, eventPublisherJob) ile tutarli: explicit connection injection.
     */
    static initialize(connection: mongoose.Connection): void;
    static getKey(userId: string, integrationId: string): string;
    /**
     * 401/403 aldiginda counter'i artir, threshold asilirsa event publish et.
     * @returns Guncel counter degeri (Redis hatasi durumunda 0)
     */
    static increment(context: AuthFailureTrackerContext, lastErrorStatus: 401 | 403, lastErrorMessage?: string): Promise<number>;
    /**
     * Basarili bir API call sonrasi counter'i sifirla.
     */
    static reset(userId: string, integrationId: string): Promise<void>;
    /**
     * Mevcut counter degerini oku (debug/UI icin).
     */
    static get(userId: string, integrationId: string): Promise<number>;
    /**
     * Threshold asildiginda IntegrationAuthFailureExceeded event'ini Outbox'a yaz.
     * AuthFailureTracker.initialize(connection) servis startup'inda cagrilmamissa
     * uyari log'lar ama exception fırlatmaz (API isteklerini kirmaz).
     */
    private static publishExceededEvent;
}
