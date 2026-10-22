import nats, { Stan } from 'node-nats-streaming';
export declare class NatsWrapper {
    private _client?;
    private _isConnected;
    private _closing;
    private _connectionLostCallbacks;
    get client(): nats.Stan;
    get isConnected(): boolean;
    /**
     * Kalıcı bağlantı kaybında (kapanış dışındaki Stan 'close') bir kez çağrılır.
     * Kısa kopmaları nats.js AYNI istemciyle kendisi toparlar ('disconnect' → 'reconnect').
     * Stan 'close' ise istemcinin kalıcı öldüğü anlamına gelir: dinleyiciler, EventPublisherJob ve istemciyi
     * değer olarak tutan her şey ölüdür. Servis bu durumda süreci kapatmalı, k8s yeniden başlatır.
     */
    onConnectionLost(callback: () => void): void;
    /**
     * Kapanışta istemciyi kapatır; bu yoldan gelen 'close' onConnectionLost'u tetiklemez.
     */
    close(): void;
    connect(clusterId: string, clientId: string, url: string): Promise<void>;
    /**
     * Request-Reply pattern implementasyonu
     * Stan üzerinde doğrudan request metodu olmadığı için manuel olarak implemente ediyoruz
     */
    request<T = any>(subject: string, data: any, options?: {
        timeout?: number;
        max?: number;
    }): Promise<T>;
}
/** Core NATS inbox öneki; replyTo bununla başlıyorsa istekçi yanıtı core NATS'te bekliyor demektir. */
export declare const CORE_REPLY_PREFIX = "_INBOX.";
/**
 * request() ile gelen komutun yanıtını gönderir.
 * Core NATS inbox'ında (`_INBOX.`) bekleyen istekçiye core NATS'ten, eski biçimdeki istekçiye
 * (`<subject>.reply.<uuid>`) STAN kanalından yanıt verir. Yanıtlayanlar istekçilerden önce bu sürüme
 * geçer (UC-950 Faz 1); istekçiler core inbox'a ancak tüm yanıtlayanlar canlıda güncellendikten sonra geçer (Faz 2).
 */
export declare const publishReply: (client: Stan, replyTo: string, data: string) => void;
export declare const createNatsWrapper: () => NatsWrapper;
//# sourceMappingURL=natsWrapper.service.d.ts.map