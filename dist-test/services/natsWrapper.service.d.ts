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
     * Request-Reply pattern implementasyonu.
     * İstek STAN kanalına yayınlanır (komut listener'ları STAN abonesidir), yanıt ise core NATS inbox'ına gelir:
     * yanıt kalıcılık gerektirmez ve her istek için STAN kanalı açmak max_channels'ı doldurur (UC-949/UC-950).
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
 * Yeni istekçi core NATS inbox'ında (`_INBOX.`) bekler; eski istekçi (`<subject>.reply.<uuid>`) STAN kanalında.
 * İki biçim de desteklenir ki istekçi ve yanıtlayan servisler farklı zamanlarda deploy edilebilsin
 * (UC-950: yanıtlayanlar Faz 1'de bu fonksiyona geçti, istekçiler Faz 2'de core inbox'a).
 */
export declare const publishReply: (client: Stan, replyTo: string, data: string) => void;
export declare const createNatsWrapper: () => NatsWrapper;
//# sourceMappingURL=natsWrapper.service.d.ts.map